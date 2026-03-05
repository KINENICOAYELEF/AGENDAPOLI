import React, { useState, useEffect, useMemo } from "react";
import { EvaluacionInicial, AnamnesisProximaV3 } from "@/types/clinica";
import { generateP2Priorities, computeIrritability } from "@/lib/auto-engine";

const MECANISMOS_CATEGORIAS = ["NoDefinido", "Aparentemente Nociceptivo", "Aparentemente Neuropático", "Aparentemente Nociplástico", "Mixto"];
const MECANISMOS_SUBTIPOS: Record<string, string[]> = {
    "Aparentemente Nociceptivo": ["Mecánico / Sobrecarga", "Inflamatorio", "Miofascial / Tejido blando", "Articular"],
    "Aparentemente Neuropático": ["Radicular / Raíz", "Nervio periférico", "Compresión / Túnel"],
    "Aparentemente Nociplástico": ["Sensibilización (central/periférica)", "Dolor persistente desproporcionado"],
    "Mixto": ["Mecánico / Sobrecarga", "Inflamatorio", "Miofascial / Tejido blando", "Articular", "Radicular / Raíz", "Nervio periférico", "Compresión / Túnel", "Sensibilización (central/periférica)", "Dolor persistente desproporcionado"],
    "NoDefinido": []
};

export interface Screen1Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
}

const REGIONES = ['Hombro', 'Codo', 'Muñeca/Mano', 'Col. Cervical', 'Col. Dorsal', 'Col. Lumbar', 'Pelvis/Sacro', 'Cadera', 'Rodilla', 'Tobillo/Pie', 'Otro'];
const LADOS = ['Izquierdo', 'Derecho', 'Bilateral', 'N/A'];

export function Screen1_Entrevista({ formData, updateFormData, isClosed }: Screen1Props) {
    // Inicialización segura V3
    const interviewV3: AnamnesisProximaV3 = formData.interview?.v3 || {
        version: "v3",
        status: "draft",
        updatedAt: new Date().toISOString(),
        painScaleMode: "EVA",
        summaryBadges: { seguridad: "Verde", irritabilidad: "NoDefinida", mecanismoTop: "NoDefinido" },
        relato: { enabled: true, text: "", aiSuggestionStatus: "idle" },
        riesgo: {
            redFlags: {
                fiebre_sistemico_cancerPrevio: false,
                bajaPeso_noIntencionada: false,
                dolorNocturno_inexplicable_noMecanico: false,
                trauma_altaEnergia_caidaImportante: false,
                neuroGraveProgresivo_esfinteres_sillaMontar: false,
                sospechaFractura_incapacidadCarga: false
            },
            overrideUrgenciaMedicaPura: false,
            notesRiesgo: ""
        },
        bpsQuick: { sueno: 0, estres: 0, miedoMoverCargar: 0, preocupacionDano: 0, bajaAutoeficacia: 0, catastrofizacion: 0, presionRetorno: 0, frustracion: 0 },
        uiConfig: { isFocosExpanded: false },
        focos: [],
        contextoDeportivo: {
            aplica: false, deportePrincipal: "", nivel: "NoDefinido", frecuenciaSemanal: null, volumenRecienteCambio: "NoDefinido", eventoProximo: "", gestoProvocador: "", objetivoRetorno: "", estadoActual: "NoAplica", horasSemanaNivel: ""
        },
        experienciaPersona: {
            creeQueLoGatillo: "", preocupacionPrincipal: "NoDefinido", expectativas: ""
        },
        automatizacionP2: { status: "idle", prioridades: [], alertas: [] }
    };

    const [activeFocoId, setActiveFocoId] = useState<string | null>(interviewV3.focos[0]?.id || null);
    const [quickSymptom, setQuickSymptom] = useState<string>("");
    const [allow5Psfs, setAllow5Psfs] = useState<boolean>(false);

    // IA State para sugerecias del Relato
    // Handlers V3
    const updateV3 = (patch: Partial<AnamnesisProximaV3>) => {
        updateFormData(prev => ({
            interview: {
                ...prev.interview,
                v3: { ...(prev.interview?.v3 as AnamnesisProximaV3 || interviewV3), ...patch }
            }
        }));
    };

    const activeFoco = interviewV3.focos.find(f => f.id === activeFocoId);

    const handleUpdateActiveFoco = (patch: any) => {
        if (!activeFocoId) return;
        const newFocos = interviewV3.focos.map(f => f.id === activeFocoId ? { ...f, ...patch } : f);
        updateV3({ focos: newFocos });
    };

    const handleAddFoco = () => {
        if (interviewV3.focos.length >= 5) return;
        const newId = Date.now().toString();
        const newFoco = {
            id: newId,
            isPrimary: interviewV3.focos.length === 0,
            region: "", lado: "N/A", historia: { inicioTipo: "NoDefinido", tiempoDesdeInicio: "", mecanismoContexto: "" },
            sintomasTags: [], dolor: { actual: null, peor24h: null, mejor24h: null }, irradiacion: "NoDefinido",
            agravantes: "", aliviantes: "", irritabilidadInputs: { dolorPostCarga: "Nunca", tiempoCalma: "" },
            funcionMeta: { limitacionPrincipal: "", psfsItems: [{ actividad: "", score0a10: null }], expectativaPaciente: "" },
            signoComparableEstrella: { nombre: "", dosificacion: "", dolor: null },
            mecanismoClasificacion: { categoria: "NoDefinido", subtipos: [], confidence0a3: 0 }
        } as any;
        updateV3({ focos: [...interviewV3.focos, newFoco] });
        setActiveFocoId(newId);
    };

    useEffect(() => {
        const isRed = interviewV3.riesgo.overrideUrgenciaMedicaPura || interviewV3.riesgo.redFlags.fiebre_sistemico_cancerPrevio || interviewV3.riesgo.redFlags.neuroGraveProgresivo_esfinteres_sillaMontar || interviewV3.riesgo.redFlags.sospechaFractura_incapacidadCarga;
        const isYellow = interviewV3.riesgo.redFlags.bajaPeso_noIntencionada || interviewV3.riesgo.redFlags.dolorNocturno_inexplicable_noMecanico || interviewV3.riesgo.redFlags.trauma_altaEnergia_caidaImportante;
        const newSafety = isRed ? 'Rojo' : (isYellow ? 'Amarillo' : 'Verde');

        let maxIrrit = 'Baja';
        let mechTop = 'NoDefinido';
        const categorias = new Set<string>();

        interviewV3.focos.forEach(f => {
            const irr = computeIrritability(f).level;
            if (irr === 'Alta') maxIrrit = 'Alta';
            else if (irr === 'Media' && maxIrrit !== 'Alta') maxIrrit = 'Media';
            if (f.mecanismoClasificacion.categoria !== 'NoDefinido') categorias.add(f.mecanismoClasificacion.categoria);
        });

        if (categorias.has('Mixto') || categorias.size >= 2) mechTop = 'Mixto';
        else if (categorias.size === 1) mechTop = Array.from(categorias)[0];

        const outputP2 = generateP2Priorities(interviewV3);

        const needsUpdate = interviewV3.summaryBadges.seguridad !== newSafety ||
            interviewV3.summaryBadges.irritabilidad !== maxIrrit ||
            interviewV3.summaryBadges.mecanismoTop !== mechTop ||
            JSON.stringify(interviewV3.automatizacionP2.prioridades) !== JSON.stringify(outputP2.prioridades) ||
            JSON.stringify(interviewV3.automatizacionP2.alertas) !== JSON.stringify(outputP2.alertas);

        if (needsUpdate) {
            updateV3({
                summaryBadges: { seguridad: newSafety as any, irritabilidad: maxIrrit as any, mecanismoTop: mechTop as any },
                automatizacionP2: outputP2
            });
        }
    }, [interviewV3.riesgo, interviewV3.focos, interviewV3.contextoDeportivo]);

    const handleCloseAnamnesis = () => {
        if (interviewV3.focos.length === 0) return alert("Debe existir al menos 1 foco para aprobar.");
        const f1 = interviewV3.focos[0];
        if (!f1.region || f1.region.trim() === '') return alert("El foco primario debe tener una región definida.");
        if (f1.dolor.actual === null) return alert("El foco primario debe tener el Dolor Actual informado.");
        if (f1.dolor.actual !== null && (f1.dolor.peor24h === null || f1.dolor.mejor24h === null)) return alert("Debe reportar peor y mejor 24h si el dolor actual está informado en Foco Primario.");
        if (interviewV3.summaryBadges.seguridad === 'Rojo') return alert("BLOQUEADO: Seguridad en Rojo. Requiere validación médica antes de avanzar P2.");

        updateV3({ status: "approved" });
        alert("¡Anamnesis V3 Estricta Aprobada! P2 habilitado.");
    };

    return (
        <div className="flex flex-col gap-6 pb-12">
            {/* STICKY HEADER V3 */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 pb-3 pt-4 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0 flex flex-col md:flex-row justify-between md:items-center gap-3">
                <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Anamnesis Próxima y Riesgo</h2>
                    <p className="text-xs text-slate-500">Razonamiento Kine Real Estructurado V3</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <div className={`px-2 py-1 rounded-full border shadow-sm flex items-center gap-1
                        ${interviewV3.summaryBadges.seguridad === 'Rojo' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                            interviewV3.summaryBadges.seguridad === 'Amarillo' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
                        Seguridad {interviewV3.summaryBadges.seguridad}
                    </div>
                    <div className="px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full shadow-sm">
                        Irrit. {interviewV3.summaryBadges.irritabilidad}
                    </div>
                    <div className="px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full shadow-sm">
                        Mecanismo: {interviewV3.summaryBadges.mecanismoTop}
                    </div>
                </div>
            </div>

            {/* SECCIÓN A: Captura Conversacional (Foco Activo) */}
            <section className="bg-indigo-50/50 border text-sm border-indigo-200 rounded-xl shadow-sm overflow-hidden p-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                        <span>💬 Captura Conversacional Rápida</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <select
                            className="bg-white border border-indigo-200 text-xs rounded p-1 outline-none text-indigo-800 font-medium"
                            value={activeFocoId || ""}
                            onChange={e => setActiveFocoId(e.target.value)}
                            disabled={isClosed}
                        >
                            {!activeFocoId && <option value="">Crear Foco 1...</option>}
                            {interviewV3.focos.map((f, i) => (
                                <option key={f.id} value={f.id}>Foco {i + 1} {f.region ? `(${f.region})` : ''}</option>
                            ))}
                        </select>
                        <button onClick={handleAddFoco} disabled={isClosed || interviewV3.focos.length >= 5} className="bg-indigo-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-indigo-700 disabled:opacity-50">
                            + Foco
                        </button>
                    </div>
                </div>

                {activeFocoId && activeFoco ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Dolor Actual ({interviewV3.painScaleMode})</label>
                            <input type="number" min="0" max={interviewV3.painScaleMode === 'EVA' ? 10 : 100} step="0.5"
                                className="w-full bg-white border border-slate-300 rounded p-2 outline-none"
                                value={activeFoco.dolor.actual ?? ""}
                                onChange={e => handleUpdateActiveFoco({ dolor: { ...activeFoco.dolor, actual: e.target.value ? Number(e.target.value) : null } })}
                                disabled={isClosed}
                            />
                        </div>
                        <div className="md:col-span-5">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Síntoma rápido (ej. Quemazón, Pinchazo)</label>
                            <div className="flex gap-2">
                                <input type="text" className="w-full bg-white border border-slate-300 rounded p-2 outline-none"
                                    value={quickSymptom} onChange={e => setQuickSymptom(e.target.value)}
                                    placeholder="Escriba síntoma y presione Enter..."
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && quickSymptom.trim()) {
                                            if (!activeFoco.sintomasTags.includes(quickSymptom.trim())) {
                                                handleUpdateActiveFoco({ sintomasTags: [...activeFoco.sintomasTags, quickSymptom.trim()] });
                                            }
                                            setQuickSymptom("");
                                        }
                                    }}
                                    disabled={isClosed}
                                />
                            </div>
                            {activeFoco.sintomasTags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {activeFoco.sintomasTags.map(t => (
                                        <span key={t} className="bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                                            {t} <button onClick={() => handleUpdateActiveFoco({ sintomasTags: activeFoco.sintomasTags.filter(x => x !== t) })} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="md:col-span-4">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Contexto/Nota al Foco</label>
                            <div className="flex gap-2">
                                <input type="text" id="nota-rapida" className="w-full bg-white border border-slate-300 rounded p-2 outline-none" placeholder="ej. Cayó corriendo" disabled={isClosed} />
                                <button onClick={() => {
                                    const val = (document.getElementById('nota-rapida') as HTMLInputElement).value;
                                    if (val) {
                                        handleUpdateActiveFoco({ historia: { ...activeFoco.historia, mecanismoContexto: activeFoco.historia.mecanismoContexto ? `${activeFoco.historia.mecanismoContexto}. ${val}` : val } });
                                        (document.getElementById('nota-rapida') as HTMLInputElement).value = '';
                                    }
                                }} disabled={isClosed} className="bg-slate-800 text-white px-3 py-2 rounded text-xs font-bold whitespace-nowrap">Añadir</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-slate-500 text-xs py-2">Seleccione o cree un foco para iniciar la captura rápida.</div>
                )}
            </section>

            {/* SECCIÓN B: Relato Opcional */}
            <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Relato del Episodio (Opcional)</h3>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
                        <input type="checkbox" checked={interviewV3.relato.enabled} onChange={e => updateV3({ relato: { ...interviewV3.relato, enabled: e.target.checked } })} disabled={isClosed} />
                        Usar Relato
                    </label>
                </div>
                {interviewV3.relato.enabled ? (
                    <div className="p-4 space-y-3">
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:bg-white outline-none"
                            rows={3}
                            placeholder="Relato de la persona usuaria..."
                            value={interviewV3.relato.text}
                            onChange={e => updateV3({ relato: { ...interviewV3.relato, text: e.target.value } })}
                            disabled={isClosed}
                        />
                        <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>Completar estructurado es suficiente. Relato sirve para auto-llenar.</span>
                            <button disabled className="bg-indigo-100 text-indigo-400 px-3 py-1.5 rounded-lg font-bold cursor-not-allowed">
                                Sugerir/autollenar (Próximamente IA)
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-3 text-xs text-slate-500 italic text-center bg-slate-50/50">
                        Relato omitido (captura estructurada / conversacional priorizada).
                    </div>
                )}
            </section>

            {/* SECCIÓN C: Seguridad (Red Flags) */}
            <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Seguridad (Red Flags)</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold
                         ${interviewV3.summaryBadges.seguridad === 'Rojo' ? 'bg-rose-100 text-rose-800' :
                            interviewV3.summaryBadges.seguridad === 'Amarillo' ? 'bg-amber-100 text-amber-800' :
                                'bg-emerald-100 text-emerald-800'}`}>
                        {interviewV3.summaryBadges.seguridad}
                    </span>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        {[
                            { key: 'fiebre_sistemico_cancerPrevio', label: 'Fiebre / Sistémico / Cáncer previo' },
                            { key: 'bajaPeso_noIntencionada', label: 'Baja de peso no intencionada' },
                            { key: 'dolorNocturno_inexplicable_noMecanico', label: 'Dolor nocturno implacable (no mecánico)' },
                            { key: 'trauma_altaEnergia_caidaImportante', label: 'Trauma alta energía / Caída importante' },
                            { key: 'neuroGraveProgresivo_esfinteres_sillaMontar', label: 'Déficit neuro grave / Esfínteres / Silla de montar' },
                            { key: 'sospechaFractura_incapacidadCarga', label: 'Sospecha de fractura / Incapacidad de carga' },
                        ].map(flag => (
                            <label key={flag.key} className="flex items-start gap-2 text-xs">
                                <input type="checkbox" className="mt-0.5"
                                    checked={(interviewV3.riesgo.redFlags as any)[flag.key]}
                                    onChange={e => updateV3({ riesgo: { ...interviewV3.riesgo, redFlags: { ...interviewV3.riesgo.redFlags, [flag.key]: e.target.checked } } })}
                                    disabled={isClosed}
                                />
                                <span>{flag.label}</span>
                            </label>
                        ))}
                    </div>
                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                        <label className="flex items-center gap-2 text-xs font-bold text-rose-600">
                            <input type="checkbox" checked={interviewV3.riesgo.overrideUrgenciaMedicaPura}
                                onChange={e => updateV3({ riesgo: { ...interviewV3.riesgo, overrideUrgenciaMedicaPura: e.target.checked } })} disabled={isClosed} />
                            Marcar Urgencia Médica Pura Manualmente (Bloquea flujo kinésico)
                        </label>
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:bg-white"
                            placeholder="Notas de riesgo / Justificación..."
                            value={interviewV3.riesgo.notesRiesgo}
                            onChange={e => updateV3({ riesgo: { ...interviewV3.riesgo, notesRiesgo: e.target.value } })}
                            disabled={isClosed}
                            rows={2}
                        />
                    </div>
                </div>
            </section>

            {/* SECCIÓN D: BPS Rápido */}
            <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-3">
                    <h3 className="font-bold text-slate-800">BPS Rápido (Banderas Amarillas/Azules)</h3>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { key: 'sueno', label: 'Alteración Sueño' },
                        { key: 'estres', label: 'Alto Estrés' },
                        { key: 'miedoMoverCargar', label: 'Miedo al mover/cargar' },
                        { key: 'preocupacionDano', label: 'Preocupación de daño' },
                        { key: 'bajaAutoeficacia', label: 'Baja autoeficacia' },
                        { key: 'catastrofizacion', label: 'Catastrofización' },
                        { key: 'presionRetorno', label: 'Presión por retorno' },
                        { key: 'frustracion', label: 'Alta frustración' },
                    ].map(flag => (
                        <div key={flag.key} className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">{flag.label}</label>
                            <div className="flex gap-1">
                                {[0, 1, 2].map(val => (
                                    <button key={val} disabled={isClosed}
                                        onClick={() => updateV3({ bpsQuick: { ...interviewV3.bpsQuick, [flag.key]: val } })}
                                        className={`flex-1 py-1 rounded text-xs font-bold border transition-colors
                                            ${(interviewV3.bpsQuick as any)[flag.key] === val
                                                ? (val === 0 ? 'bg-slate-800 text-white border-slate-800' : val === 1 ? 'bg-amber-500 text-white border-amber-500' : 'bg-rose-600 text-white border-rose-600')
                                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="col-span-2 md:col-span-4 mt-2">
                        <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs outline-none focus:bg-white"
                            placeholder="Otros factores BPS..." value={interviewV3.bpsQuick.otros || ''}
                            onChange={e => updateV3({ bpsQuick: { ...interviewV3.bpsQuick, otros: e.target.value } })} disabled={isClosed} />
                    </div>
                </div>
            </section>
            <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">Mapa de Focos Estructurado ({interviewV3.focos.length}/5)</h3>
                    <div className="flex gap-2">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={interviewV3.uiConfig.isFocosExpanded} onChange={e => updateV3({ uiConfig: { ...interviewV3.uiConfig, isFocosExpanded: e.target.checked } })} disabled={isClosed} />
                            Colapsar Todos
                        </label>
                        <button onClick={handleAddFoco} disabled={isClosed || interviewV3.focos.length >= 5} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded font-bold">
                            + Foco Nuevo
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {interviewV3.focos.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Inicie captura en Sección A para construir el mapa.</p>}

                    {interviewV3.focos.map((foco, idx) => (
                        <div key={foco.id} className="border border-indigo-100 rounded-lg overflow-hidden bg-white shadow-sm">
                            {/* Cabecera Foco */}
                            <div className="bg-indigo-50/50 p-2.5 px-3 border-b border-indigo-100 flex justify-between items-center cursor-pointer" onClick={() => {
                                // Simple toggle visual (opcional)
                            }}>
                                <div className="flex items-center gap-2">
                                    <strong className="text-indigo-800 text-xs">{foco.isPrimary ? 'FOCO P. (1)' : `FOCO SEC. (${idx + 1})`}</strong>
                                    {foco.region && <span className="text-[10px] bg-white border px-1.5 py-0.5 rounded text-indigo-600 font-bold">{foco.region} {foco.lado !== 'N/A' ? `(${foco.lado})` : ''}</span>}
                                    {foco.dolor.actual !== null && <span className="text-[10px] bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded text-rose-700 font-bold">Dolor {foco.dolor.actual}</span>}
                                </div>
                                <div className="flex gap-2 items-center">
                                    {activeFocoId !== foco.id && (
                                        <button onClick={(e) => { e.stopPropagation(); setActiveFocoId(foco.id); }} disabled={isClosed} className="text-[10px] text-indigo-600 underline font-medium">Fijar A</button>
                                    )}
                                    <button onClick={(e) => {
                                        e.stopPropagation();
                                        updateV3({ focos: interviewV3.focos.filter(f => f.id !== foco.id) });
                                        if (activeFocoId === foco.id) setActiveFocoId(null);
                                    }} disabled={isClosed} className="text-rose-500 hover:text-rose-700 font-medium text-[10px] border px-1.5 rounded bg-white">Borrar</button>
                                </div>
                            </div>

                            {/* Cuerpo Foco (Mostrado u Oculto según isFocosExpanded) */}
                            {(!interviewV3.uiConfig.isFocosExpanded || activeFocoId === foco.id) && (
                                <div className="p-3">
                                    {/* Subsecciones colapsables del foco */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* E.1 Historia / Mecanismo */}
                                        <div className="border border-slate-100 rounded p-2.5 bg-slate-50/50">
                                            <h4 className="font-bold text-[10px] uppercase text-slate-500 mb-2 border-b pb-1">Historia y Mecanismo</h4>
                                            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                                <input type="text" placeholder="Región (ej. Hombro)" className="border rounded px-2 py-1 bg-white"
                                                    value={foco.region} onChange={e => {
                                                        const nf = [...interviewV3.focos]; nf[idx].region = e.target.value; updateV3({ focos: nf });
                                                    }} disabled={isClosed} />
                                                <select className="border rounded px-2 py-1 bg-white" value={foco.lado} onChange={e => {
                                                    const nf = [...interviewV3.focos]; nf[idx].lado = e.target.value as any; updateV3({ focos: nf });
                                                }} disabled={isClosed}>
                                                    <option value="N/A">N/A</option><option value="Izquierdo">Izq</option><option value="Derecho">Der</option><option value="Bilateral">Bi</option><option value="Central">Central</option>
                                                </select>
                                                <select className="border rounded px-2 py-1 bg-white" value={foco.historia.inicioTipo} onChange={e => {
                                                    const nf = [...interviewV3.focos]; nf[idx].historia.inicioTipo = e.target.value as any; updateV3({ focos: nf });
                                                }} disabled={isClosed}>
                                                    <option value="NoDefinido">Inicio...</option><option value="Subito">Súbito (Trauma)</option><option value="Gradual">Gradual/Progresivo</option><option value="Insidioso">Insidioso (Sin causa)</option>
                                                </select>
                                                <input type="text" placeholder="Tiempo (ej. 3 sem)" className="border rounded px-2 py-1 bg-white"
                                                    value={foco.historia.tiempoDesdeInicio} onChange={e => {
                                                        const nf = [...interviewV3.focos]; nf[idx].historia.tiempoDesdeInicio = e.target.value; updateV3({ focos: nf });
                                                    }} disabled={isClosed} />
                                            </div>
                                            <textarea className="w-full border rounded px-2 py-1 bg-white text-xs h-12 outline-none" placeholder="Contexto Mecanismo detallado..."
                                                value={foco.historia.mecanismoContexto} onChange={e => {
                                                    const nf = [...interviewV3.focos]; nf[idx].historia.mecanismoContexto = e.target.value; updateV3({ focos: nf });
                                                }} disabled={isClosed} />
                                        </div>

                                        {/* E.2 Perfil de Dolor/Síntomas */}
                                        <div className="border border-slate-100 rounded p-2.5 bg-slate-50/50">
                                            <h4 className="font-bold text-[10px] uppercase text-slate-500 mb-2 border-b pb-1">Perfil Síntomas ({foco.dolor.actual}/{interviewV3.painScaleMode})</h4>
                                            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                                <div className="flex gap-1 items-center bg-white border rounded px-1">
                                                    <span className="text-[10px] text-slate-400 ml-1">Mejor</span>
                                                    <input type="number" className="w-10 text-center outline-none" min={0} value={foco.dolor.mejor24h ?? ''} onChange={e => {
                                                        const nf = [...interviewV3.focos]; nf[idx].dolor.mejor24h = e.target.value ? Number(e.target.value) : null; updateV3({ focos: nf });
                                                    }} disabled={isClosed} />
                                                </div>
                                                <div className="flex gap-1 items-center bg-white border rounded px-1">
                                                    <span className="text-[10px] text-rose-400 font-bold ml-1">Peor</span>
                                                    <input type="number" className="w-10 text-center outline-none" min={0} value={foco.dolor.peor24h ?? ''} onChange={e => {
                                                        const nf = [...interviewV3.focos]; nf[idx].dolor.peor24h = e.target.value ? Number(e.target.value) : null; updateV3({ focos: nf });
                                                    }} disabled={isClosed} />
                                                </div>
                                            </div>
                                            <select className="w-full border rounded px-2 py-1 bg-white text-xs mb-2" value={foco.irradiacion} onChange={e => {
                                                const nf = [...interviewV3.focos]; nf[idx].irradiacion = e.target.value as any; updateV3({ focos: nf });
                                            }} disabled={isClosed}>
                                                <option value="NoDefinido">Irradiación...</option><option value="Local">Local</option><option value="Referido">Referido</option><option value="Radicular">Radicular</option><option value="Extendida">Extendida</option>
                                            </select>
                                            <div className="text-[10px] text-slate-500 mb-1">Tags (De Sec A): {foco.sintomasTags.join(', ') || '-'}</div>
                                        </div>

                                        {/* E.3 Modificadores & Función */}
                                        <div className="md:col-span-2 border border-slate-100 rounded p-2.5 bg-slate-50/50">
                                            <h4 className="font-bold text-[10px] uppercase text-slate-500 mb-2 border-b pb-1">Modificadores (Comportamiento) & Función</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400">Agravantes (+)</label>
                                                    <input type="text" className="w-full border rounded px-2 py-1 bg-white text-xs" value={foco.agravantes} onChange={e => {
                                                        const nf = [...interviewV3.focos]; nf[idx].agravantes = e.target.value; updateV3({ focos: nf });
                                                    }} disabled={isClosed} placeholder="ej. Sentadilla >90°" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400">Aliviantes (-)</label>
                                                    <input type="text" className="w-full border rounded px-2 py-1 bg-white text-xs" value={foco.aliviantes} onChange={e => {
                                                        const nf = [...interviewV3.focos]; nf[idx].aliviantes = e.target.value; updateV3({ focos: nf });
                                                    }} disabled={isClosed} placeholder="ej. Reposo, calor" />
                                                </div>
                                                <div className="col-span-full grid grid-cols-2 gap-2 mt-1">
                                                    <div className="flex flex-col">
                                                        <label className="text-[9px] font-bold text-slate-500">Inputs de Irritabilidad:</label>
                                                        <select className="border rounded px-1 py-1 bg-white text-[10px]" value={foco.irritabilidadInputs.dolorPostCarga} onChange={e => {
                                                            const nf = [...interviewV3.focos]; nf[idx].irritabilidadInputs.dolorPostCarga = e.target.value as any; updateV3({ focos: nf });
                                                        }} disabled={isClosed}>
                                                            <option value="Nunca">Dolor post-actividad?</option><option value="Menor2h">&lt;2h (Leve)</option><option value="Mayor2h">&gt;2h (Moder)</option><option value="TodaLaNoche">Toda la Noche/Día sgte (Severa)</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex flex-col justify-end">
                                                        <input type="text" className="border rounded px-1 py-1 bg-white text-[10px]" placeholder="Tiempo en calmar (ej. 3 hrs)" value={foco.irritabilidadInputs.tiempoCalma} onChange={e => {
                                                            const nf = [...interviewV3.focos]; nf[idx].irritabilidadInputs.tiempoCalma = e.target.value; updateV3({ focos: nf });
                                                        }} disabled={isClosed} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-3 border-t pt-2">
                                                <h5 className="text-[10px] font-bold text-indigo-800 mb-1 flex justify-between items-center">
                                                    <div className="flex gap-2 items-center">
                                                        <span>Escala Funcional (PSFS Ligero)</span>
                                                        <label className="text-[9px] text-slate-500 flex items-center gap-1 cursor-pointer font-normal border border-slate-200 px-1 rounded bg-white"><input type="checkbox" checked={allow5Psfs} onChange={e => setAllow5Psfs(e.target.checked)} /> Hasta 5 ítems</label>
                                                    </div>
                                                    <button onClick={() => {
                                                        const nf = [...interviewV3.focos];
                                                        if (nf[idx].funcionMeta.psfsItems.length < (allow5Psfs ? 5 : 3)) nf[idx].funcionMeta.psfsItems.push({ actividad: '', score0a10: null });
                                                        updateV3({ focos: nf });
                                                    }} disabled={isClosed || foco.funcionMeta.psfsItems.length >= (allow5Psfs ? 5 : 3)} className="text-[9px] bg-white border px-1 rounded text-slate-600 disabled:opacity-50">+ Añadir Actividad</button>
                                                </h5>
                                                {foco.funcionMeta.psfsItems.map((psfs, i) => (
                                                    <div key={i} className="flex gap-1 items-center mb-1">
                                                        <input type="text" className="flex-1 border rounded px-2 py-1 bg-white text-xs" placeholder={`Actividad Clave ${i + 1}`} value={psfs.actividad} onChange={e => {
                                                            const nf = [...interviewV3.focos]; nf[idx].funcionMeta.psfsItems[i].actividad = e.target.value; updateV3({ focos: nf });
                                                        }} disabled={isClosed} />
                                                        <input type="number" min={0} max={10} className="w-12 border rounded px-1 py-1 bg-white text-xs text-center" placeholder="0-10" value={psfs.score0a10 ?? ''} onChange={e => {
                                                            const nf = [...interviewV3.focos]; nf[idx].funcionMeta.psfsItems[i].score0a10 = e.target.value ? Number(e.target.value) : null; updateV3({ focos: nf });
                                                        }} disabled={isClosed} />
                                                    </div>
                                                ))}
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    <input type="text" className="w-full border rounded px-2 py-1 bg-white text-xs" placeholder="Signo Comparable BASE (Ej. Sentadilla)" value={foco.signoComparableEstrella.nombre} onChange={e => {
                                                        const nf = [...interviewV3.focos]; nf[idx].signoComparableEstrella.nombre = e.target.value; updateV3({ focos: nf });
                                                    }} disabled={isClosed} />
                                                    <input type="number" min={0} max={10} className="w-full border rounded px-2 py-1 bg-white text-xs" placeholder={`Dolor en Signo (0-10)`} value={foco.signoComparableEstrella.dolor ?? ''} onChange={e => {
                                                        const nf = [...interviewV3.focos]; nf[idx].signoComparableEstrella.dolor = e.target.value ? Number(e.target.value) : null; updateV3({ focos: nf });
                                                    }} disabled={isClosed} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* E.4 Mecanismo Clínico (Apellidos) */}
                                        <div className="md:col-span-2 border border-slate-100 rounded p-2.5 bg-slate-50/50 mt-1">
                                            <h4 className="font-bold text-[10px] uppercase text-slate-500 mb-2 border-b pb-1">Identificación de Mecanismo de Dolor (Pilar 3)</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3">
                                                <select className="border border-indigo-200 rounded px-2 py-1.5 bg-white text-xs text-indigo-900 font-bold outline-none" value={foco.mecanismoClasificacion.categoria} onChange={e => {
                                                    const nf = [...interviewV3.focos];
                                                    nf[idx].mecanismoClasificacion.categoria = e.target.value as any;
                                                    nf[idx].mecanismoClasificacion.subtipos = []; // reset al cambiar cat
                                                    updateV3({ focos: nf });
                                                }} disabled={isClosed}>
                                                    {MECANISMOS_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                                <div className="flex flex-wrap gap-1 items-center">
                                                    {(MECANISMOS_SUBTIPOS[foco.mecanismoClasificacion.categoria] || []).map(sub => (
                                                        <button key={sub} disabled={isClosed}
                                                            onClick={() => {
                                                                const nf = [...interviewV3.focos];
                                                                const curr = nf[idx].mecanismoClasificacion.subtipos;
                                                                nf[idx].mecanismoClasificacion.subtipos = curr.includes(sub) ? curr.filter(x => x !== sub) : [...curr, sub];
                                                                updateV3({ focos: nf });
                                                            }}
                                                            className={`text-[9px] px-1.5 py-1 border rounded shadow-sm transition-colors ${foco.mecanismoClasificacion.subtipos.includes(sub) ? 'bg-indigo-600 text-white border-indigo-700 font-bold' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-300'}`}>
                                                            {sub}
                                                        </button>
                                                    ))}
                                                    {foco.mecanismoClasificacion.categoria === 'NoDefinido' && <span className="text-[10px] text-slate-400 italic">Selecciona una categoría primero para ver sus apellidos.</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* SECCIÓN F & G: Contexto Deportivo y Experiencia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <h3 className="font-bold text-slate-800 mb-3 border-b pb-2">Contexto Deportivo</h3>
                    <label className="flex items-center gap-2 text-xs mb-3 font-medium text-slate-700">
                        <input type="checkbox" checked={interviewV3.contextoDeportivo.aplica} onChange={e => updateV3({ contextoDeportivo: { ...interviewV3.contextoDeportivo, aplica: e.target.checked } })} disabled={isClosed} />
                        Persona practica deporte/actividad física regular
                    </label>
                    {interviewV3.contextoDeportivo.aplica && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                            <input type="text" placeholder="Deporte Principal (Ej. Fútbol, CrossFit)" className="w-full text-xs p-2 border border-slate-300 rounded outline-none" disabled={isClosed}
                                value={interviewV3.contextoDeportivo.deportePrincipal || ''} onChange={e => updateV3({ contextoDeportivo: { ...interviewV3.contextoDeportivo, deportePrincipal: e.target.value } })} />
                            <select className="w-full text-xs p-2 border border-slate-300 rounded outline-none" value={interviewV3.contextoDeportivo.estadoActual || ''} onChange={e => updateV3({ contextoDeportivo: { ...interviewV3.contextoDeportivo, estadoActual: e.target.value as any } })} disabled={isClosed}>
                                <option value="">Estado Actual...</option>
                                {['Normal_SinDolor', 'Normal_ConDolor', 'Modificado', 'ReposoDeportivo', 'NoAplica'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input type="text" placeholder="Horas por seman / Nivel competitivo" className="w-full text-xs p-2 border border-slate-300 rounded outline-none" disabled={isClosed}
                                value={interviewV3.contextoDeportivo.horasSemanaNivel || ''} onChange={e => updateV3({ contextoDeportivo: { ...interviewV3.contextoDeportivo, horasSemanaNivel: e.target.value } })} />
                        </div>
                    )}
                </section>

                <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <h3 className="font-bold text-slate-800 mb-3 border-b pb-2">Experiencia de la Persona</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">¿Qué cree que causó el problema?</label>
                            <input type="text" placeholder="Creencia de Causa..." value={interviewV3.experienciaPersona.creeQueLoGatillo} onChange={e => updateV3({ experienciaPersona: { ...interviewV3.experienciaPersona, creeQueLoGatillo: e.target.value } })} disabled={isClosed} className="w-full text-xs p-2 border border-slate-300 rounded outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Principal Preocupación</label>
                            <input type="text" placeholder="Ej. Romperse algo, no volver a jugar..." value={interviewV3.experienciaPersona.preocupacionPrincipal} onChange={e => updateV3({ experienciaPersona: { ...interviewV3.experienciaPersona, preocupacionPrincipal: e.target.value as any } })} disabled={isClosed} className="w-full text-xs p-2 border border-slate-300 rounded outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Expectativa Kinésica</label>
                            <input type="text" placeholder="¿Qué espera lograr?" value={interviewV3.experienciaPersona.expectativas} onChange={e => updateV3({ experienciaPersona: { ...interviewV3.experienciaPersona, expectativas: e.target.value } })} disabled={isClosed} className="w-full text-xs p-2 border border-slate-300 rounded outline-none" />
                        </div>
                    </div>
                </section>
            </div>

            {/* SECCIÓN H: Visualización Automatización P2 */}
            <section className="bg-indigo-900 border text-sm border-indigo-950 rounded-xl shadow-inner overflow-hidden mb-8">
                <div className="p-3 border-b border-indigo-800 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2">🤖 Automatización hacia Examen Físico (P2)</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-indigo-800 px-2 py-0.5 rounded border border-indigo-700">Prioridades P2 generadas: {interviewV3.automatizacionP2.prioridades.length > 0 ? 'Sí' : 'No'}</span>
                    </div>
                </div>
                <div className="p-4 bg-indigo-950/50">
                    {interviewV3.automatizacionP2.alertas.map((al, idx) => (
                        <div key={idx} className={`text-xs p-2 mb-3 rounded border font-medium ${al.nivel === 'Block' ? 'bg-rose-900 overflow-hidden text-rose-100 border-rose-700' : 'bg-amber-900 text-amber-100 border-amber-700'}`}>
                            ⚠️ {al.mensaje}
                        </div>
                    ))}
                    {interviewV3.automatizacionP2.prioridades.length === 0 ? (
                        <p className="text-xs text-indigo-300 italic">Complete la anamnesis para rellenar las prioridades del examen guiado.</p>
                    ) : (
                        <div className="space-y-3">
                            {interviewV3.automatizacionP2.prioridades.map(prio => (
                                <div key={prio.focoId} className="border border-indigo-800 rounded bg-indigo-900/40 p-3">
                                    <strong className="text-[10px] uppercase text-indigo-300 block mb-2">Sugerencias Foco {interviewV3.focos.findIndex(f => f.id === prio.focoId) + 1}</strong>
                                    <div className="space-y-2">
                                        {prio.items.map((it, i) => (
                                            <div key={i} className="flex gap-2 bg-indigo-900/40 p-1.5 rounded">
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold self-start mt-0.5 ${it.prioridad === 'Alta' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>{it.tipo}</span>
                                                <div className="flex flex-col text-xs leading-none mt-0.5">
                                                    <span className="text-indigo-100 font-bold mb-1">{it.label}</span>
                                                    <span className="text-[10px] text-indigo-400">Razón: {it.razon}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* SECCIÓN I: Cierre Estructurado */}
            <section className="bg-emerald-50 border text-sm border-emerald-200 rounded-xl shadow-sm p-5 text-center flex flex-col items-center">
                <h3 className="font-bold text-emerald-900 mb-2 text-lg">Cierre de Anamnesis V3</h3>
                <p className="text-xs text-emerald-700 mb-5 max-w-lg">
                    Revisa que los focos importantes estén capturados. El Riesgo actual es <strong>{interviewV3.summaryBadges.seguridad}</strong>.
                    {interviewV3.summaryBadges.seguridad === 'Rojo' && <span className="block mt-1 font-bold text-rose-600 bg-rose-100 p-2 rounded">ATENCIÓN: Riesgo Rojo exige confirmación clínica para avanzar o detener pase a físico.</span>}
                </p>
                <button onClick={handleCloseAnamnesis} disabled={isClosed} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3 rounded-xl transition shadow text-sm disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider">
                    🔒 Aprobar y Avanzar a Examen Físico (P2)
                </button>
            </section>
        </div >
    );
}

