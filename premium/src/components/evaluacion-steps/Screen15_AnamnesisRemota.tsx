import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { RemoteHistory, PersonaUsuaria } from "@/types/personaUsuaria";
import { BaseEvaluacion } from "@/types/clinica";
import { buildBasalSynthesis } from "@/utils/remoteHistoryFormatter";
const INITIAL_REMOTE_HISTORY: RemoteHistory = {
    medicalHistory: {
        diagnoses: [], chronicDiseases: [], surgeries: [], medications: [], allergies: [], clinicalConsiderations: '', criticalModifiers: []
    },
    mskHistory: {
        relevantInjuries: [], recurrences: '', mskSurgeries: [], usefulTreatments: '', uselessTreatments: '', previousImaging: '', persistentSequelae: '', historicalProblemRegion: ''
    },
    baseActivity: {
        primarySport: '', level: '', weeklyFrequency: '', typicalDuration: '', yearsExperience: '', basalGoal: '', competitiveCalendar: '', surfaceOrEquipment: '', doubleLoad: ''
    },
    occupationalContext: {
        mainRole: '', physicalDemands: '', shifts: '', timeSitting: '', timeStanding: '', weightLifting: '', repetitiveMovements: '', driving: '', adherenceBarriers: []
    },
    bpsContext: {
        sleepQuality: '', sleepHours: '', stressLevel: '', basalMood: '', socialSupport: '', smoking: '', alcohol: '', otherHabits: '', poorAdherenceHistory: '', protectiveFactors: ''
    },
    permanentNotes: '',
    lastUpdated: new Date().toISOString()
};

const ArrayField = ({ label, items, onChange, placeholder, disabled }: any) => (
    <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">{label}</label>
        <input
            type="text"
            value={items?.map((i: any) => i.name || i.region).join(', ') || ''}
            onChange={e => {
                const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                onChange(arr.map(name => ({ name, region: name }))); // maneja tanto name como region (truco)
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none bg-slate-50 disabled:opacity-60 disabled:bg-slate-100 transition-colors shadow-sm"
        />
    </div>
);

export function Screen15_AnamnesisRemota({
    usuariaId,
    formData,
    updateFormData,
    isClosed
}: {
    usuariaId: string,
    formData: BaseEvaluacion,
    updateFormData: (patch: Partial<BaseEvaluacion>) => void,
    isClosed: boolean
}) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();
    const [loading, setLoading] = useState(!formData.remoteHistorySnapshot);

    // Deep merge function para asegurar que todos los nidos existan
    const deepMergeWithInitial = (source?: Partial<RemoteHistory>): RemoteHistory => {
        if (!source) return { ...INITIAL_REMOTE_HISTORY, updatedByClinician: user?.email || 'Desconocido' };
        return {
            ...INITIAL_REMOTE_HISTORY,
            ...source,
            medicalHistory: { ...INITIAL_REMOTE_HISTORY.medicalHistory, ...(source.medicalHistory || {}) },
            mskHistory: { ...INITIAL_REMOTE_HISTORY.mskHistory, ...(source.mskHistory || {}) },
            baseActivity: { ...INITIAL_REMOTE_HISTORY.baseActivity, ...(source.baseActivity || {}) },
            occupationalContext: { ...INITIAL_REMOTE_HISTORY.occupationalContext, ...(source.occupationalContext || {}) },
            bpsContext: { ...INITIAL_REMOTE_HISTORY.bpsContext, ...(source.bpsContext || {}) },
            updatedByClinician: user?.email || 'Desconocido'
        };
    };

    const [history, setHistory] = useState<RemoteHistory>(deepMergeWithInitial(formData.remoteHistorySnapshot as any));

    useEffect(() => {
        if (formData.remoteHistorySnapshot) return;
        if (!globalActiveYear || !usuariaId) return;

        const fetchPerson = async () => {
            try {
                const docRef = doc(db, "programs", globalActiveYear, "personas", usuariaId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as PersonaUsuaria;
                    if (data.remoteHistory) {
                        // Aquí si trae "comorbidities" (legacy) deberiamos tirarlo a chronicDiseases en el futuro. 
                        // Por ahora sólo rehidratamos el base dict.
                        const mergedHistory = deepMergeWithInitial(data.remoteHistory as any);
                        const historyConSintesis = { ...mergedHistory, basalSynthesis: buildBasalSynthesis(mergedHistory) };
                        setHistory(historyConSintesis);
                        updateFormData({ remoteHistorySnapshot: historyConSintesis });
                    } else {
                        const baseConSintesis = { ...history, basalSynthesis: buildBasalSynthesis(history) };
                        updateFormData({ remoteHistorySnapshot: baseConSintesis });
                    }
                }
            } catch (error) {
                console.error("Error fetching remote history:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPerson();
    }, [globalActiveYear, usuariaId, formData.remoteHistorySnapshot]);

    const handleChange = (newHistory: RemoteHistory) => {
        const historyConSintesis = { ...newHistory, basalSynthesis: buildBasalSynthesis(newHistory) };
        setHistory(historyConSintesis);
        updateFormData({ remoteHistorySnapshot: historyConSintesis });
    };

    const updateNested = (category: keyof RemoteHistory, field: string, value: any) => {
        handleChange({
            ...history,
            [category]: {
                ...(history[category] as any),
                [field]: value
            }
        });
    };



    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 animate-pulse space-y-4">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></div>
                <p className="text-sm font-medium tracking-wide">Consultando registro basal central...</p>
            </div>
        );
    }

    // Helper para renderizar Radios tipo "Chips" en vez de Selects
    const RadioGroup = ({ label, value, options, onChange, disabled }: any) => (
        <div className="space-y-2">
            <label className="block text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                {label}
            </label>
            <div className="flex flex-wrap gap-2">
                {options.map((opt: any) => (
                    <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(opt.value)}
                        className={`text-[11px] px-3 py-1.5 rounded-full border transition-all duration-200 
                            ${value === opt.value
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 font-semibold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'} 
                            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );

    // Helper para renderizar Multi-Select "Chips"
    const MultiSelectChips = ({ label, values, options, onChange, disabled }: any) => {
        // Safe check for legacy string data vs array
        const safeValues = Array.isArray(values) ? values : (typeof values === 'string' && values.length > 0 ? [values] : []);

        const toggleValue = (val: string) => {
            if (safeValues.includes(val)) {
                onChange(safeValues.filter((v: string) => v !== val));
            } else {
                onChange([...safeValues, val]);
            }
        };

        return (
            <div className="space-y-2">
                <label className="block text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                    {label}
                </label>
                <div className="flex flex-wrap gap-2">
                    {options.map((opt: any) => {
                        const isSelected = safeValues.includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                disabled={disabled}
                                onClick={() => toggleValue(opt.value)}
                                className={`text-[11px] px-3 py-1.5 rounded-full border transition-all duration-200 
                                    ${isSelected
                                        ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-200 font-semibold'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-rose-300 hover:bg-rose-50'} 
                                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-400">
            {/* CABECERA PREMIUM */}
            <div className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-100/50 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-40 -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10 w-full">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight">
                            P1.5: Anamnesis Remota <span className="text-indigo-600 font-light">| Perfil Basal</span>
                        </h2>
                    </div>
                    <p className="text-slate-600 text-sm font-medium md:max-w-3xl leading-relaxed">
                        Este apartado define el <b>terreno biológico y psicosocial</b> del paciente. <br className="hidden sm:block" />
                        Se guardará como la foto clínica central reutilizable en el expediente. No registres síntomas del episodio agudo actual aquí.
                    </p>
                </div>
            </div>

            {/* GUIA DE ENTREVISTA REMOTA OBLIGATORIA (PROMPT 1) */}
            <details className="group bg-slate-50 border border-slate-200 rounded-xl shadow-sm overflow-hidden text-sm">
                <summary className="flex items-center gap-2 p-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors select-none">
                    <svg className="w-5 h-5 text-indigo-500 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span>Guía de entrevista remota (?)</span>
                </summary>
                <div className="p-4 pt-0 text-slate-600 space-y-3 leading-relaxed border-t border-slate-200/60 bg-white">
                    <p className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 mb-4">
                        ⚠️ ATENCIÓN: Esta pantalla es exclusivamente para perfil basal de largo plazo. NO registrar aquí el cuadro actual, motivo de consulta ni irradiaciones del episodio presente (eso pertenece a la Anamnesis Próxima).
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-[13px]">
                        <li><strong className="text-slate-800">Historial médico clínico:</strong> preguntar por enfermedades crónicas, cirugías, RAMs y condiciones que modifiquen la cicatrización o dicten bandera roja sistémica.</li>
                        <li><strong className="text-slate-800">Antecedentes MSK:</strong> preguntar por lesiones previas, recurrencias, secuelas, tratamientos previos y estudios relevantes.</li>
                        <li><strong className="text-slate-800">Actividad habitual y carga basal:</strong> preguntar por el nivel de entrenamiento histórico, sueldos de carga deportiva vs física y objetivos.</li>
                        <li><strong className="text-slate-800">Contexto ocupacional:</strong> preguntar por jornada, tipo de demanda dominante (ej. sedente vs esfuerzo de pie) y potenciales barreras logísticas.</li>
                        <li><strong className="text-slate-800">Terreno biopsicosocial:</strong> preguntar por factores estables (calidad de sueño histórico, estilo de afrontamiento al estrés, redes de apoyo reales).</li>
                        <li><strong className="text-slate-800">Notas basales:</strong> registrar puramente contexto persistente.</li>
                    </ul>
                </div>
            </details>

            {/* SECCION 1: HISTORIA MEDICA Y CONSIDERACIONES */}
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow duration-300">
                <div className="bg-rose-50/50 border-b border-rose-100 p-4 sm:p-5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-lg">🏥</div>
                    <h3 className="text-sm font-bold text-rose-950 uppercase tracking-widest">1. Historial Médico Clínico</h3>
                </div>
                <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                    <ArrayField label="Diagnósticos médicos relevantes" items={history.medicalHistory?.diagnoses} onChange={(v: any) => updateNested('medicalHistory', 'diagnoses', v)} placeholder="HTA, Hipotiroidismo, Cáncer..." disabled={isClosed} />
                    <ArrayField label="Alergias / RAM" items={history.medicalHistory?.allergies} onChange={(v: any) => updateNested('medicalHistory', 'allergies', v)} placeholder="Penicilina, AINES..." disabled={isClosed} />
                    <ArrayField label="Cirugías previas" items={history.medicalHistory?.surgeries} onChange={(v: any) => updateNested('medicalHistory', 'surgeries', v)} placeholder="Apendicectomía, Cesárea..." disabled={isClosed} />
                    <ArrayField label="Farmacoterapia actual relevante" items={history.medicalHistory?.medications} onChange={(v: any) => updateNested('medicalHistory', 'medications', v)} placeholder="Losartán, Omeprazol, Anticonceptivos..." disabled={isClosed} />
                    <div className="md:col-span-2 space-y-4">
                        <MultiSelectChips
                            label="Modificadores Clínicos Basales"
                            values={history.medicalHistory?.criticalModifiers || []}
                            onChange={(v: any) => updateNested('medicalHistory', 'criticalModifiers', v)}
                            options={[
                                { label: 'Diabetes', value: 'diabetes' },
                                { label: 'Inf. / Reumatológica', value: 'reumatologica' },
                                { label: 'Osteoporosis/penia', value: 'osteoporosis' },
                                { label: 'Oncológico', value: 'oncologico' },
                                { label: 'Anticoagulación', value: 'anticoagulacion' },
                                { label: 'Corticoides Crónicos', value: 'corticoides' },
                                { label: 'Neurológica', value: 'neurologica' },
                                { label: 'Cardiorrespiratoria', value: 'cardiorrespiratoria' },
                                { label: 'Otro', value: 'otro' }
                            ]}
                            disabled={isClosed}
                        />

                        <div>
                            <label className="block text-[10px] font-bold text-rose-800 mb-1.5 uppercase tracking-wider">
                                Detalle Clínico <span className="text-[10px] font-normal text-rose-500 bg-rose-100 px-2 py-0.5 rounded-full">Requiere consideración clínica especial</span>
                            </label>
                            <textarea
                                value={history.medicalHistory?.clinicalConsiderations || ''}
                                onChange={e => updateNested('medicalHistory', 'clinicalConsiderations', e.target.value)}
                                disabled={isClosed}
                                placeholder="Ej. Paciente oncológico en remisión, diabetes mal controlada con riesgo tisular neuropático, uso crónico de corticoides (riesgo óseo/tendinoso), etc."
                                className="w-full border border-rose-200 rounded-xl px-4 py-3 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-200/50 focus:outline-none min-h-[100px] bg-rose-50 border-l-4 border-l-rose-400 disabled:opacity-60 resize-y transition-shadow placeholder:text-rose-300"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCION 2: MSK Y DEPORTIVO PREVIO */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-shadow duration-300">
                <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-lg">🦴</div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">2. Antecedentes Musculoesqueléticos Previos</h3>
                </div>
                <div className="p-5 sm:p-6 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                        <ArrayField label="Lesiones previas (Por región)" items={history.mskHistory?.relevantInjuries} onChange={(v: any) => updateNested('mskHistory', 'relevantInjuries', v)} placeholder="Esguince tobillo der 2020, Tendinopatia..." disabled={isClosed} />
                        <ArrayField label="Cirugías Ortopédicas/Traumatológicas" items={history.mskHistory?.mskSurgeries} onChange={(v: any) => updateNested('mskHistory', 'mskSurgeries', v)} placeholder="LCA rodilla derecha 2018..." disabled={isClosed} />

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Región Históricamente Problemática</label>
                            <input type="text" value={history.mskHistory?.historicalProblemRegion || ''} onChange={e => updateNested('mskHistory', 'historicalProblemRegion', e.target.value)} disabled={isClosed} placeholder="Ej: Toda la cadena posterior derecha" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-slate-400 focus:ring-1 focus:ring-slate-400 outline-none shadow-sm transition-shadow bg-slate-50 focus:bg-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Patrón de Recurrencias / Episodios</label>
                            <input type="text" value={history.mskHistory?.recurrences || ''} onChange={e => updateNested('mskHistory', 'recurrences', e.target.value)} disabled={isClosed} placeholder="Atascamiento lumbar 1 vez al año..." className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-slate-400 focus:ring-1 focus:ring-slate-400 outline-none shadow-sm transition-shadow bg-slate-50 focus:bg-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 pt-4 border-t border-slate-100">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Tratamientos Previos Exitosos</label>
                            <textarea value={history.mskHistory?.usefulTreatments || ''} onChange={e => updateNested('mskHistory', 'usefulTreatments', e.target.value)} disabled={isClosed} placeholder="Punción seca, ejercicio progresivo..." className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50 disabled:opacity-60 h-24 resize-y" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Tratamientos Inútiles o Mal Tolerados</label>
                            <textarea value={history.mskHistory?.uselessTreatments || ''} onChange={e => updateNested('mskHistory', 'uselessTreatments', e.target.value)} disabled={isClosed} placeholder="Ondas de choque (agudizó dolor), masajes pasivos..." className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50 disabled:opacity-60 h-24 resize-y" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Secuelas / Limitaciones Persistentes</label>
                            <textarea value={history.mskHistory?.persistentSequelae || ''} onChange={e => updateNested('mskHistory', 'persistentSequelae', e.target.value)} disabled={isClosed} placeholder="Rango limitado en flexión de rodilla izq..." className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50 disabled:opacity-60 h-24 resize-y" />
                        </div>
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Imágenes Preventivas / Históricas Relevantes</label>
                            <input type="text" value={history.mskHistory?.previousImaging || ''} onChange={e => updateNested('mskHistory', 'previousImaging', e.target.value)} disabled={isClosed} placeholder="RM Lumbar 2021: protrusión L4-L5 asintomática actual..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-400 outline-none shadow-sm disabled:opacity-60 bg-slate-50 focus:bg-white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCION 3: DEPORTE Y CARGA BASAL */}
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
                {/* BLOQUE DEPORTE */}
                <details className="group" open>
                    <summary className="flex justify-between items-center bg-white p-4 cursor-pointer hover:bg-emerald-50/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">🏃</div>
                            <h3 className="text-sm font-bold text-emerald-950 uppercase tracking-widest">3. Actividad Física Habitual y Carga Basal</h3>
                        </div>
                    </summary>
                    <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="sm:col-span-2 lg:col-span-1">
                            <label className="block text-[10px] font-bold text-emerald-800/70 mb-1.5 uppercase tracking-wider">Actividad / Deporte Central</label>
                            <input type="text" value={history.baseActivity?.primarySport || ''} onChange={e => updateNested('baseActivity', 'primarySport', e.target.value)} disabled={isClosed} placeholder="CrossFit, Pádel, Sedentario..." className="w-full border border-emerald-200/60 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-lg text-sm px-3 py-2.5 outline-none shadow-sm transition-colors" />
                        </div>

                        <div className="sm:col-span-2">
                            <RadioGroup
                                label="Nivel de Práctica Actual"
                                value={history.baseActivity?.level || ''}
                                onChange={(v: string) => updateNested('baseActivity', 'level', v)}
                                disabled={isClosed}
                                options={[
                                    { label: 'Ninguno/Sedentario', value: 'sedentario' },
                                    { label: 'Recreacional Suave', value: 'recreacional_bajo' },
                                    { label: 'Recreacional Frecuente', value: 'recreacional_alto' },
                                    { label: 'Amateur Comp.', value: 'amateur_competitivo' },
                                    { label: 'Alto Rendimiento', value: 'profesional' }
                                ]}
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-emerald-800/70 mb-1.5 uppercase tracking-wider">Frecuencia Semanal</label>
                            <input type="text" value={history.baseActivity?.weeklyFrequency || ''} onChange={e => updateNested('baseActivity', 'weeklyFrequency', e.target.value)} disabled={isClosed} placeholder="ej. 3 a 4 veces" className="w-full border border-emerald-200/60 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-lg text-sm px-3 py-2.5 outline-none shadow-sm transition-colors" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-emerald-800/70 mb-1.5 uppercase tracking-wider">Duración Típica</label>
                            <input type="text" value={history.baseActivity?.typicalDuration || ''} onChange={e => updateNested('baseActivity', 'typicalDuration', e.target.value)} disabled={isClosed} placeholder="ej. 60-90 min" className="w-full border border-emerald-200/60 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-lg text-sm px-3 py-2.5 outline-none shadow-sm transition-colors" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-emerald-800/70 mb-1.5 uppercase tracking-wider">Experiencia Acumulada</label>
                            <input type="text" value={history.baseActivity?.yearsExperience || ''} onChange={e => updateNested('baseActivity', 'yearsExperience', e.target.value)} disabled={isClosed} placeholder="ej. 2 años" className="w-full border border-emerald-200/60 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-lg text-sm px-3 py-2.5 outline-none shadow-sm transition-colors" />
                        </div>
                        <div className="lg:col-span-3 pt-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-emerald-50/30 rounded-xl border border-emerald-50">
                                <div>
                                    <label className="block text-[10px] font-bold text-emerald-800 mb-1.5 uppercase tracking-wider">Doble Carga Basal (Deporte + Trabajo/Estudio)</label>
                                    <input type="text" value={history.baseActivity?.doubleLoad || ''} onChange={e => updateNested('baseActivity', 'doubleLoad', e.target.value)} disabled={isClosed} placeholder="Ej: Trabajo físico intenso DE DÍA + Crossfit de noche" className="w-full border border-emerald-200/60 bg-white rounded-lg text-sm px-3 py-2 shadow-sm focus:border-emerald-400 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-emerald-800 mb-1.5 uppercase tracking-wider">Calendario Competitivo u Objetivo</label>
                                    <input type="text" value={history.baseActivity?.competitiveCalendar || ''} onChange={e => updateNested('baseActivity', 'competitiveCalendar', e.target.value)} disabled={isClosed} placeholder="Torneo el próximo mes / Maratón 42k" className="w-full border border-emerald-200/60 bg-white rounded-lg text-sm px-3 py-2 shadow-sm focus:border-emerald-400 outline-none" />
                                </div>
                            </div>
                        </div>
                    </div>
                </details>
            </div>

            {/* SECCION 4: OCUPACION Y CONTEXTO */}
            <div className="bg-white rounded-2xl border border-sky-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow duration-300">
                <div className="bg-sky-50/50 border-b border-sky-100 p-4 sm:p-5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-lg">💼</div>
                    <h3 className="text-sm font-bold text-sky-950 uppercase tracking-widest">4. Contexto Ocupacional y Demandas Físicas</h3>
                </div>
                <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-sky-800 mb-1.5 uppercase tracking-wider">Ocupación / Rol Ocupacional Principal</label>
                        <input type="text" value={history.occupationalContext?.mainRole || ''} onChange={e => updateNested('occupationalContext', 'mainRole', e.target.value)} disabled={isClosed} placeholder="Ingeniera Civil, Teletrabajo, Mecánico Auto..." className="w-full border border-sky-200/60 focus:border-sky-400 focus:ring-1 focus:ring-sky-200 rounded-lg text-sm px-4 py-2.5 outline-none shadow-sm transition-colors" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-sky-800 mb-1.5 uppercase tracking-wider">Jornada / Horarios</label>
                        <select value={history.occupationalContext?.shifts || ''} onChange={e => updateNested('occupationalContext', 'shifts', e.target.value)} disabled={isClosed} className="w-full border border-sky-200/60 rounded-lg text-sm py-2.5 px-3 focus:border-sky-400 outline-none shadow-sm appearance-none bg-white">
                            <option value="">Seleccione formato...</option>
                            <option value="diurna_fija">Diurna Fija</option>
                            <option value="turnos_rotativos">Turnos Rotativos (Día/Noche)</option>
                            <option value="independiente">Flexible / Freelance</option>
                        </select>
                    </div>

                    <div className="md:col-span-3 pt-2">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Matriz de Carga Laboral</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1.5">🪑 Tiempo Sedente</label>
                                <select value={history.occupationalContext?.timeSitting || ''} onChange={e => updateNested('occupationalContext', 'timeSitting', e.target.value)} disabled={isClosed} className="w-full text-xs font-medium text-slate-700 bg-slate-50 border-slate-200 rounded-lg border py-2 px-3 focus:bg-white outline-none">
                                    <option value="">--</option><option value="bajo">Casi Nulo</option><option value="medio">Mixto (2-4h)</option><option value="alto">Alto (&gt;6h continuas)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1.5">🧍 Tiempo de Pie</label>
                                <select value={history.occupationalContext?.timeStanding || ''} onChange={e => updateNested('occupationalContext', 'timeStanding', e.target.value)} disabled={isClosed} className="w-full text-xs font-medium text-slate-700 bg-slate-50 border-slate-200 rounded-lg border py-2 px-3 focus:bg-white outline-none">
                                    <option value="">--</option><option value="bajo">Casi Nulo</option><option value="medio">Parcial / Rotativo</option><option value="alto">Estático Prolongado</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1.5">📦 Carga/Levante</label>
                                <select value={history.occupationalContext?.weightLifting || ''} onChange={e => updateNested('occupationalContext', 'weightLifting', e.target.value)} disabled={isClosed} className="w-full text-xs font-medium text-slate-700 bg-slate-50 border-slate-200 rounded-lg border py-2 px-3 focus:bg-white outline-none">
                                    <option value="">--</option><option value="no">Nada</option><option value="ocasional">Ocasional Liviano</option><option value="frecuente_pesado">Frecuente Pesado</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1.5">🔄 Movimiento Rept.</label>
                                <select value={history.occupationalContext?.repetitiveMovements || ''} onChange={e => updateNested('occupationalContext', 'repetitiveMovements', e.target.value)} disabled={isClosed} className="w-full text-xs font-medium text-slate-700 bg-slate-50 border-slate-200 rounded-lg border py-2 px-3 focus:bg-white outline-none">
                                    <option value="">--</option><option value="no">Poco/Nada</option><option value="ms_sup">MMSS (Teclado, Fabrica)</option><option value="ms_inf">MMII</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-3 mt-2 lg:flex lg:gap-6 space-y-4 lg:space-y-0 items-start">
                        <div className="flex-1">
                            {/* Chips de Adherencia en lugar de input libre */}
                            <MultiSelectChips
                                label="Barreras Basales Logísticas"
                                values={history.occupationalContext?.adherenceBarriers || []}
                                onChange={(v: any) => updateNested('occupationalContext', 'adherenceBarriers', v)}
                                disabled={isClosed}
                                options={[
                                    { label: 'Tiempo', value: 'tiempo' },
                                    { label: 'Transporte', value: 'transporte' },
                                    { label: 'Dinero', value: 'dinero' },
                                    { label: 'Turnos', value: 'turnos' },
                                    { label: 'Distancia', value: 'distancia' },
                                    { label: 'Apoyo', value: 'apoyo' },
                                    { label: 'Otra', value: 'otra' }
                                ]}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-sky-800 mb-1.5 uppercase tracking-wider">Exposición en trayectos / Conducción</label>
                            <input type="text" value={history.occupationalContext?.driving || ''} onChange={e => updateNested('occupationalContext', 'driving', e.target.value)} disabled={isClosed} placeholder="Maneja 2h diarias en tráfico..." className="w-full border border-sky-200/60 focus:border-sky-400 focus:ring-1 focus:ring-sky-200 rounded-lg text-sm px-3 py-2 outline-none shadow-sm" />
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCION 5: BPS Y FACTORES PROTECTORES */}
            <div className="bg-white rounded-2xl border border-amber-200/60 shadow-sm overflow-hidden">
                {/* BLOQUE BPS */}
                <details className="group" open>
                    <summary className="flex justify-between items-center bg-white p-4 cursor-pointer hover:bg-amber-50/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">🔋</div>
                            <h3 className="text-sm font-bold text-amber-950 uppercase tracking-widest">5. Terreno Biopsicosocial y Hábitos Basales</h3>
                        </div>
                    </summary>
                    <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">

                        <RadioGroup
                            label="Calidad del Sueño (Basal)"
                            value={history.bpsContext?.sleepQuality || ''}
                            onChange={(v: string) => updateNested('bpsContext', 'sleepQuality', v)}
                            disabled={isClosed}
                            options={[
                                { label: '🟢 Buena/Reparadora', value: 'good' },
                                { label: '🟡 Regular', value: 'ok' },
                                { label: '🔴 Mala / Insomnio', value: 'poor' }
                            ]}
                        />

                        <RadioGroup
                            label="Niveles de Estrés (Basal)"
                            value={history.bpsContext?.stressLevel || ''}
                            onChange={(v: string) => updateNested('bpsContext', 'stressLevel', v)}
                            disabled={isClosed}
                            options={[
                                { label: '🟢 Bajo', value: 'low' },
                                { label: '🟡 Medio (Picos)', value: 'med' },
                                { label: '🔴 Alto/Crónico', value: 'high' }
                            ]}
                        />

                        <RadioGroup
                            label="Estado de Ánimo Basal"
                            value={history.bpsContext?.basalMood || ''}
                            onChange={(v: string) => updateNested('bpsContext', 'basalMood', v)}
                            disabled={isClosed}
                            options={[
                                { label: 'Positivo/Resiliente', value: 'good' },
                                { label: 'Fluctuante', value: 'fluctuating' },
                                { label: 'Bajo/Ansioso', value: 'low' }
                            ]}
                        />

                        <RadioGroup
                            label="Red de Apoyo Social"
                            value={history.bpsContext?.socialSupport || ''}
                            onChange={(v: string) => updateNested('bpsContext', 'socialSupport', v)}
                            disabled={isClosed}
                            options={[
                                { label: 'Fuerte apoyo', value: 'high' },
                                { label: 'Normal', value: 'ok' },
                                { label: 'Aislado / Bajo', value: 'low' }
                            ]}
                        />

                        <RadioGroup
                            label="Tabaquismo"
                            value={history.bpsContext?.smoking || ''}
                            onChange={(v: string) => updateNested('bpsContext', 'smoking', v)}
                            disabled={isClosed}
                            options={[
                                { label: 'No Fuma', value: 'no' },
                                { label: 'Ex Fumador', value: 'ex_fumador' },
                                { label: 'Social', value: 'fuma_social' },
                                { label: 'Diario', value: 'fuma_diario' }
                            ]}
                        />

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-amber-50">
                            <div>
                                <label className="block text-[10px] font-bold text-amber-800 mb-1.5 uppercase tracking-wider">Otros Hábitos Relevantes (Alcohol/Drogas/Dieta)</label>
                                <input type="text" value={history.bpsContext?.otherHabits || ''} onChange={e => updateNested('bpsContext', 'otherHabits', e.target.value)} disabled={isClosed} placeholder="Dieta hipercalórica, Alcohol fines de semana..." className="w-full border border-amber-200/60 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 rounded-lg text-sm px-3 py-2 outline-none shadow-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-green-700 mb-1.5 uppercase tracking-wider">Factores Protectores a destacar</label>
                                <input type="text" value={history.bpsContext?.protectiveFactors || ''} onChange={e => updateNested('bpsContext', 'protectiveFactors', e.target.value)} disabled={isClosed} placeholder="Ex-deportista pro, altísima resiliencia..." className="w-full border border-green-200/60 focus:border-green-400 bg-green-50/30 rounded-lg text-sm px-3 py-2 outline-none shadow-sm" />
                            </div>
                        </div>
                    </div>
                </details>
            </div>

            {/* SECCION 6: NOTAS BASALES */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* BLOQUE NOTAS */}
                <details className="group" open>
                    <summary className="flex justify-between items-center bg-white p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">📝</div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">6. Notas Clínicas Basales Relevantes</h3>
                        </div>
                    </summary>
                    <div className="p-5 sm:p-6">
                        <textarea
                            value={history.permanentNotes || ''}
                            onChange={e => handleChange({ ...history, permanentNotes: e.target.value })}
                            disabled={isClosed}
                            placeholder="Usa este espacio para construir un relato macro del paciente en el tiempo. Ej: 'Paciente sumamente aprehensivo respecto a su hombro derecho tras caída en 2011, tiende a catastrofizar dolores radiculares ligeros. Mejor canal de enseñanza: cinestésico.' NO uses este espacio para dolor actual."
                            className="w-full border border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-4 text-[15px] min-h-[160px] resize-y leading-relaxed outline-none shadow-inner bg-slate-50/50"
                        />
                    </div>
                </details>
            </div>

            {/* FOOTER ESPACIADOR */}
            <div className="h-10"></div>
        </div>
    );
}
