import React, { useState, useEffect, useCallback } from "react";
import { EvaluacionInicial, AnamnesisProximaV4 } from "@/types/clinica";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";

export interface Screen1Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
}

const REGIONES = ['Hombro', 'Codo', 'Muñeca/Mano', 'Col. Cervical', 'Col. Dorsal', 'Col. Lumbar', 'Pelvis/Sacro', 'Cadera', 'Rodilla', 'Tobillo/Pie', 'Otro'];
const LADOS = ['Izquierdo', 'Derecho', 'Bilateral', 'N/A'];

const MECANISMOS_CATEGORIAS = ["NoDefinido", "Aparentemente Nociceptivo", "Aparentemente Neuropático", "Aparentemente Nociplástico", "Mixto"];
const MECANISMOS_SUBTIPOS: Record<string, string[]> = {
    "Aparentemente Nociceptivo": ["Mecánico / Sobrecarga", "Inflamatorio", "Miofascial / Tejido blando", "Articular"],
    "Aparentemente Neuropático": ["Radicular / Raíz", "Nervio periférico", "Compresión / Túnel"],
    "Aparentemente Nociplástico": ["Sensibilización (central/periférica)", "Dolor persistente desproporcionado"],
    "Mixto": ["Mecánico / Sobrecarga", "Inflamatorio", "Miofascial / Tejido blando", "Articular", "Radicular / Raíz", "Nervio periférico", "Compresión / Túnel", "Sensibilización (central/periférica)", "Dolor persistente desproporcionado"],
    "NoDefinido": []
};

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
            dolorActual: null, mejor24h: null, peor24h: null, irradiacion: "NoDefinido", tags: [],
            agravantes: "", aliviantes: "", dolorPostActividad: "NoDefinida", tiempoCalma: "",
            signoComparable: "", dolorEnSigno: null, mecanismoCategoria: "NoDefinido", mecanismoApellido: [], mecanismoTextoFinal: "", notaRapida: ""
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

    const isRiesgoAlto = interviewV4.seguridad.overrideUrgenciaMedica ||
        interviewV4.seguridad.fiebre_sistemico_cancerPrevio ||
        interviewV4.seguridad.neuroGraveProgresivo_esfinteres_sillaMontar ||
        interviewV4.seguridad.sospechaFractura_incapacidadCarga;

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
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Seguridad: Verde
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

            {/* DETALLE FOCO ACTIVO */}
            {activeFoco && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Básicos */}
                    <div className="space-y-3 border-r border-indigo-100 pr-4">
                        {!activeFoco.esPrincipal && (
                            <button
                                onClick={() => {
                                    const newFocos = interviewV4.focos.map(f => ({ ...f, esPrincipal: f.id === activeFoco.id }));
                                    updateV4({ focos: newFocos });
                                }}
                                disabled={isClosed}
                                className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded font-bold hover:bg-amber-100 w-full mb-1 transition-colors"
                            >
                                ⭐ Marcar este Foco como Principal
                            </button>
                        )}
                        <div className="flex gap-2">
                            <input type="text" placeholder="Región (Ej. Hombro)" className="flex-1 w-full text-xs p-2 border border-slate-300 rounded outline-none" value={activeFoco.region} onChange={e => handleUpdateActiveFoco({ region: e.target.value })} disabled={isClosed} />
                            <select className="text-xs p-2 border border-slate-300 rounded outline-none bg-white" value={activeFoco.lado} onChange={e => handleUpdateActiveFoco({ lado: e.target.value })} disabled={isClosed}>
                                <option value="N/A">N/A</option><option value="Izquierdo">Izq</option><option value="Derecho">Der</option><option value="Bilateral">Bi</option>
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <select className="w-1/2 text-xs p-2 border border-slate-300 rounded outline-none bg-white" value={activeFoco.inicio} onChange={e => handleUpdateActiveFoco({ inicio: e.target.value })} disabled={isClosed}>
                                <option value="NoDefinido">Inicio...</option><option value="Subito_Trauma">Súbito (Trauma)</option><option value="Subito_SinTrauma">Súbito (Sin Trauma)</option><option value="Gradual">Gradual/Progresivo</option><option value="Reagudizacion">Reagudización</option>
                            </select>
                            <input type="text" placeholder="Tiempo (Ej. 3 sem)" className="w-1/2 text-xs p-2 border border-slate-300 rounded outline-none" value={activeFoco.tiempoDesdeInicio} onChange={e => handleUpdateActiveFoco({ tiempoDesdeInicio: e.target.value })} disabled={isClosed} />
                        </div>

                        <textarea className="w-full text-xs p-2 border border-slate-300 rounded outline-none" rows={2} placeholder="Contexto Detallado del mecanismo o foco..." value={activeFoco.contextoDetallado} onChange={e => handleUpdateActiveFoco({ contextoDetallado: e.target.value })} disabled={isClosed} />

                        <div className="bg-white border text-xs p-2 rounded">
                            <div className="font-bold text-slate-500 mb-1">Dolor ({interviewV4.escalaDolorGlobal})</div>
                            <div className="flex gap-2">
                                <input type="number" placeholder="Actual" className="w-1/3 p-1.5 border rounded outline-none text-center" value={activeFoco.dolorActual ?? ''} onChange={e => handleUpdateActiveFoco({ dolorActual: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                                <input type="number" placeholder="Peor 24h" className="w-1/3 p-1.5 border rounded outline-none text-center text-rose-600 font-bold" value={activeFoco.peor24h ?? ''} onChange={e => handleUpdateActiveFoco({ peor24h: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                                <input type="number" placeholder="Mejor 24h" className="w-1/3 p-1.5 border rounded outline-none text-center text-emerald-600 font-bold" value={activeFoco.mejor24h ?? ''} onChange={e => handleUpdateActiveFoco({ mejor24h: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                            </div>
                        </div>
                    </div>

                    {/* Modificadores y Avanzado */}
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <input type="text" placeholder="Agravantes (+)" className="w-1/2 text-xs p-2 border border-slate-300 rounded outline-none" value={activeFoco.agravantes} onChange={e => handleUpdateActiveFoco({ agravantes: e.target.value })} disabled={isClosed} />
                            <input type="text" placeholder="Aliviantes (-)" className="w-1/2 text-xs p-2 border border-slate-300 rounded outline-none" value={activeFoco.aliviantes} onChange={e => handleUpdateActiveFoco({ aliviantes: e.target.value })} disabled={isClosed} />
                        </div>

                        <div className="bg-white border text-xs p-2 rounded">
                            <div className="font-bold text-slate-500 mb-1">Irritabilidad</div>
                            <div className="flex gap-2">
                                <select className="w-1/2 p-1.5 border rounded outline-none" value={activeFoco.dolorPostActividad} onChange={e => handleUpdateActiveFoco({ dolorPostActividad: e.target.value })} disabled={isClosed}>
                                    <option value="NoDefinida">Dolor post-actividad?</option><option value="Nunca">Nunca</option><option value="A veces">A veces</option><option value="Frecuente">Frecuente</option><option value="Siempre">Siempre</option>
                                </select>
                                <input type="text" placeholder="Tiempo Calma (ej 2hr)" className="w-1/2 p-1.5 border rounded outline-none" value={activeFoco.tiempoCalma} onChange={e => handleUpdateActiveFoco({ tiempoCalma: e.target.value })} disabled={isClosed} />
                            </div>
                        </div>

                        <div className="bg-white border text-xs p-2 rounded">
                            <div className="font-bold text-slate-500 mb-1">Signo Comparable Base</div>
                            <div className="flex gap-2">
                                <input type="text" placeholder="Gesto/Test Clínico" className="w-2/3 p-1.5 border rounded outline-none" value={activeFoco.signoComparable} onChange={e => handleUpdateActiveFoco({ signoComparable: e.target.value })} disabled={isClosed} />
                                <input type="number" placeholder="Dolor" className="w-1/3 p-1.5 border rounded outline-none text-center" value={activeFoco.dolorEnSigno ?? ''} onChange={e => handleUpdateActiveFoco({ dolorEnSigno: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                            </div>
                        </div>

                        <div className="bg-white border text-xs p-2 rounded">
                            <div className="font-bold text-slate-500 mb-1">Apellidos (Mecanismo)</div>
                            <select className="w-full p-1.5 border rounded outline-none mb-1 font-bold text-indigo-700" value={activeFoco.mecanismoCategoria} onChange={e => handleUpdateActiveFoco({ mecanismoCategoria: e.target.value, mecanismoApellido: [] })} disabled={isClosed}>
                                {MECANISMOS_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div className="flex flex-wrap gap-1">
                                {(MECANISMOS_SUBTIPOS[activeFoco.mecanismoCategoria] || []).map(sub => (
                                    <button key={sub} disabled={isClosed}
                                        onClick={() => {
                                            const curr = activeFoco.mecanismoApellido;
                                            handleUpdateActiveFoco({ mecanismoApellido: curr.includes(sub) ? curr.filter(x => x !== sub) : [...curr, sub] });
                                        }}
                                        className={`text-[9px] px-1 py-0.5 border rounded ${activeFoco.mecanismoApellido.includes(sub) ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>
                                        {sub}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white border text-xs p-2 rounded">
                            <div className="font-bold text-slate-500 mb-1">Síntomas / Hechos Clínicos (Tags)</div>
                            <div className="flex flex-wrap gap-1">
                                {activeFoco.tags.length === 0 ? <span className="text-slate-400 italic">No hay síntomas...</span> : null}
                                {activeFoco.tags.map(t => (
                                    <span key={t} className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                        {t}
                                        <button onClick={() => handleUpdateActiveFoco({ tags: activeFoco.tags.filter(x => x !== t) })} className="hover:text-rose-500">×</button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white border text-xs p-2 rounded mt-2">
                            <div className="font-bold text-slate-500 mb-1">Notas Rápidas (Log)</div>
                            <textarea
                                className="w-full text-xs p-2 border border-slate-300 rounded outline-none"
                                rows={3}
                                placeholder="Notas de captura conversacional..."
                                value={activeFoco.notaRapida || ""}
                                onChange={e => handleUpdateActiveFoco({ notaRapida: e.target.value })}
                                disabled={isClosed}
                            />
                        </div>
                    </div>
                </div>
            )}

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
                    <h3 className="font-bold text-rose-800 border-b border-rose-100 pb-2 mb-3">Red Flags (Seguridad)</h3>
                    <div className="space-y-2 text-xs">
                        {[
                            { key: 'fiebre_sistemico_cancerPrevio', label: 'Fiebre / Sistémico / Cáncer previo' },
                            { key: 'bajaPeso_noIntencionada', label: 'Baja peso inexplicable' },
                            { key: 'dolorNocturno_inexplicable_noMecanico', label: 'Dolor nocturno no mecánico' },
                            { key: 'trauma_altaEnergia_caidaImportante', label: 'Trauma / Caída importante' },
                            { key: 'neuroGraveProgresivo_esfinteres_sillaMontar', label: 'Neuro progresivo / Silla montar' },
                            { key: 'sospechaFractura_incapacidadCarga', label: 'Incapacidad de carga (Fx)' },
                        ].map(flag => (
                            <label key={flag.key} className="flex items-start gap-2">
                                <input type="checkbox" className="mt-0.5" checked={(interviewV4.seguridad as any)[flag.key]} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, [flag.key]: e.target.checked } })} disabled={isClosed} />
                                <span>{flag.label}</span>
                            </label>
                        ))}
                    </div>
                </section>

                <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <h3 className="font-bold text-slate-800 border-b pb-2 mb-3">BPS Rápido (0 - 2)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            { key: 'sueno', label: 'Sueño' }, { key: 'estres', label: 'Estrés' }, { key: 'miedoMoverCargar', label: 'Kinesiofobia' }, { key: 'preocupacionDano', label: 'Catastr/Daño' },
                            { key: 'bajaAutoeficacia', label: 'Autoeficacia' }, { key: 'presionRetorno', label: 'Presión RTp' }, { key: 'frustracion', label: 'Frustración' }
                        ].map(flag => (
                            <div key={flag.key} className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-500 uppercase truncate" title={flag.label}>{flag.label}</label>
                                <div className="flex gap-0.5">
                                    {[0, 1, 2].map(val => (
                                        <button key={val} disabled={isClosed}
                                            onClick={() => updateV4({ bps: { ...interviewV4.bps, [flag.key]: val } })}
                                            className={`flex-1 py-1 text-[10px] rounded-sm font-bold border transition-colors ${(interviewV4.bps as any)[flag.key] === val ? (val === 0 ? 'bg-slate-800 text-white' : val === 1 ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white') : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                                        >
                                            {val}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* SECCIÓN Cierre Estructurado */}
            <section className="bg-emerald-50 border text-sm border-emerald-200 rounded-xl shadow-sm p-5 text-center flex flex-col items-center">
                <h3 className="font-bold text-emerald-900 mb-2 text-lg">Cierre de Anamnesis V4</h3>
                <p className="text-xs text-emerald-700 mb-5 max-w-lg">
                    Revisa que los focos importantes estén capturados.
                    {isRiesgoAlto && <span className="block mt-2 font-bold text-rose-600 bg-rose-100 p-2 rounded">ATENCIÓN: Riesgo Alto de seguridad detectado. Evalúe derivación antes de avance físico.</span>}
                </p>
                <button onClick={handleCloseAnamnesis} disabled={isClosed} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3 rounded-xl transition shadow text-sm disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider border border-emerald-800">
                    🔒 Aprobar y Avanzar a Examen Físico (P2)
                </button>
            </section>
        </div >
    );
}
