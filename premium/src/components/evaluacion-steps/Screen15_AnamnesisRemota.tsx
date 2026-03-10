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
        diagnoses: [], chronicDiseases: [], surgeries: [], medications: [], allergies: [], clinicalConsiderations: '', criticalModifiers: [], condicionesClinicasRelevantes: []
    },
    biologicalFactors: {
        embarazoActual: false, postpartoReciente: false, lactancia: false, perimenopausiaMenopausia: false, alteracionesMenstruales: false, antecedentePelvico: false, observacion: ''
    },
    mskHistory: {
        relevantInjuries: [], recurrences: '', mskSurgeries: [], usefulTreatments: '', uselessTreatments: '', previousImaging: '', persistentSequelae: '', historicalProblemRegion: '', dominancia: '', usoOrtesis: ''
    },
    baseActivity: {
        primarySport: '', categoria: '', level: '', weeklyFrequency: '', typicalDuration: '', yearsExperience: '', basalGoal: '', competitiveCalendar: '', surfaceOrEquipment: '', doubleLoad: ''
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
        <label className="block text-[10px] uppercase font-bold text-slate-600 tracking-wider mb-1.5">{label}</label>
        <input
            type="text"
            value={items?.map((i: any) => i.name || i.region).join(', ') || ''}
            onChange={e => {
                const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                onChange(arr.map(name => ({ name, region: name })));
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none bg-slate-50 disabled:opacity-60 disabled:bg-slate-100 transition-colors shadow-sm"
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

    const deepMergeWithInitial = (source?: Partial<RemoteHistory>): RemoteHistory => {
        if (!source) return { ...INITIAL_REMOTE_HISTORY, updatedByClinician: user?.email || 'Desconocido' };
        return {
            ...INITIAL_REMOTE_HISTORY,
            ...source,
            medicalHistory: { ...INITIAL_REMOTE_HISTORY.medicalHistory, ...(source.medicalHistory || {}) },
            biologicalFactors: { ...INITIAL_REMOTE_HISTORY.biologicalFactors, ...(source.biologicalFactors || {}) },
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

    const RadioGroup = ({ label, value, options, onChange, disabled }: any) => (
        <div className="space-y-2">
            <label className="block text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                {label}
            </label>
            <div className="flex flex-wrap gap-2">
                {options.map((opt: any) => (
                    <button
                        key={opt.value} type="button" disabled={disabled} onClick={() => onChange(value === opt.value ? '' : opt.value)}
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

    const MultiSelectChips = ({ label, values, options, onChange, disabled }: any) => {
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
                                key={opt.value} type="button" disabled={disabled} onClick={() => toggleValue(opt.value)}
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

    // Componente especializado para Condiciones Clínicas (Fase 45)
    const CondicionesClinicasSelector = ({ history, updateNested, isClosed }: any) => {
        const opciones = [
            'Hipertensión arterial', 'Diabetes', 'Enfermedad tiroidea', 'Enfermedad inflamatoria / reumatológica',
            'Osteopenia / osteoporosis', 'Antecedente oncológico', 'Enfermedad neurológica relevante',
            'Enfermedad cardiovascular relevante', 'Enfermedad respiratoria relevante', 'Trastorno de salud mental relevante', 'Otra'
        ];
        const actuales = history.medicalHistory.condicionesClinicasRelevantes || [];

        const toggleCondicion = (name: string) => {
            const exists = actuales.find((c: any) => c.name === name);
            let nuevas;
            if (exists) {
                nuevas = actuales.filter((c: any) => c.name !== name);
            } else {
                nuevas = [...actuales, { name, estado: '', tratamiento: false, observacion: '' }];
            }
            updateNested('medicalHistory', 'condicionesClinicasRelevantes', nuevas);
        };

        const updateDetalle = (name: string, field: string, value: any) => {
            const nuevas = actuales.map((c: any) => c.name === name ? { ...c, [field]: value } : c);
            updateNested('medicalHistory', 'condicionesClinicasRelevantes', nuevas);
        };

        return (
            <div className="space-y-4">
                <label className="block text-[10px] uppercase font-bold text-slate-600 tracking-wider">Condiciones Clínicas Relevantes</label>
                <div className="flex flex-wrap gap-2">
                    {opciones.map(opt => {
                        const isSelected = actuales.some((c: any) => c.name === opt);
                        return (
                            <button
                                key={opt} type="button" disabled={isClosed} onClick={() => toggleCondicion(opt)}
                                className={`text-[11px] px-3 py-1.5 rounded-full border transition-all ${isSelected ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-rose-50'}`}
                            >
                                {opt}
                            </button>
                        );
                    })}
                </div>
                {actuales.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {actuales.map((c: any) => (
                            <div key={c.name} className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl space-y-3">
                                <h4 className="text-[11px] font-bold text-rose-900 border-b border-rose-200 pb-1.5 uppercase">{c.name}</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <select disabled={isClosed} value={c.estado} onChange={e => updateDetalle(c.name, 'estado', e.target.value)} className="text-xs p-2 rounded-lg outline-none border border-slate-200 bg-white">
                                        <option value="">Estado...</option>
                                        <option value="Controlada">Controlada</option>
                                        <option value="No controlada">No controlada</option>
                                        <option value="No sabe">No sabe</option>
                                    </select>
                                    <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                                        <input
                                            disabled={isClosed} type="checkbox"
                                            checked={c.tratamiento} onChange={e => updateDetalle(c.name, 'tratamiento', e.target.checked)}
                                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                                        />
                                        Tratamiento actual
                                    </label>
                                </div>
                                <input disabled={isClosed} type="text" placeholder="Observación breve..." value={c.observacion} onChange={e => updateDetalle(c.name, 'observacion', e.target.value)} className="w-full text-xs p-2 rounded-lg border border-slate-200 outline-none bg-white placeholder:text-slate-400" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-400">
            {/* CABECERA */}
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

            {/* GUIA DE ENTREVISTA REMOTA */}
            <details className="bg-indigo-50/50 rounded-xl border border-indigo-100 shadow-sm group">
                <summary className="p-4 flex items-center justify-between cursor-pointer text-indigo-900 font-bold text-sm tracking-wide select-none">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Guía de Entrevista Remota
                    </div>
                    <svg className="w-5 h-5 text-indigo-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="p-5 border-t border-indigo-100 bg-white grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700 leading-relaxed">
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <h4 className="font-bold text-indigo-800 mb-2 uppercase text-[10px] tracking-wider border-b border-indigo-100 pb-1">1. Historial Médico Clínico</h4>
                            <p><b>Cómo abrir la pregunta:</b> "¿Hay alguna enfermedad, cirugía o tratamiento que hoy condicione tu ejercicio, recuperación o controles médicos?"</p>
                            <p><b>Si responde muy general:</b> "¿Eso sigue activo? ¿Está controlado? ¿Usas tratamiento actual?"</p>
                            <p className="text-rose-600 font-medium"><b>Qué registrar:</b> Solo condiciones que cambien evaluación, recuperación, seguridad o pronóstico.</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <h4 className="font-bold text-indigo-800 mb-2 uppercase text-[10px] tracking-wider border-b border-indigo-100 pb-1">2. Antecedentes MSK Previos</h4>
                            <p><b>Cómo abrir la pregunta:</b> "¿Has tenido dolores o lesiones pasadas que hayan dejado alguna molestia, limitación o temor?"</p>
                            <p><b>Si responde muy general:</b> "¿De todas esas, alguna requirió kine larga, cirugía o no mejoró del todo?"</p>
                            <p className="text-rose-600 font-medium"><b>Qué registrar:</b> Regiones problemáticas, secuelas, y qué le sirvió o no le sirvió históricamente.</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <h4 className="font-bold text-indigo-800 mb-2 uppercase text-[10px] tracking-wider border-b border-indigo-100 pb-1">3. Actividad Física y Carga</h4>
                            <p><b>Cómo abrir la pregunta:</b> "En una semana típica actual o de la que vienes, ¿qué tipo de actividad o ejercicio haces?"</p>
                            <p><b>Si responde muy general:</b> "¿Cuántos días a la semana? ¿Cuánto tiempo? ¿Tienes algún torneo pronto o es solo por salud?"</p>
                            <p className="text-rose-600 font-medium"><b>Qué registrar:</b> Deporte central, si compite o es recreacional, frecuencia acumulada y su meta de salud/deporte basal.</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <h4 className="font-bold text-indigo-800 mb-2 uppercase text-[10px] tracking-wider border-b border-indigo-100 pb-1">4. Contexto Ocupacional</h4>
                            <p><b>Cómo abrir la pregunta:</b> "¿En qué trabajas o estudias principalmente, y cómo es tu jornada de carga física allí?"</p>
                            <p><b>Si responde muy general:</b> "¿Pasas muchas horas sentado, levantas peso ocasional, haces turnos de noche, pasas muchas horas viajando?"</p>
                            <p className="text-rose-600 font-medium"><b>Qué registrar:</b> Posiciones sostenidas, logística y barreras para venir a kine o hacer ejercicios en casa.</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <h4 className="font-bold text-indigo-800 mb-2 uppercase text-[10px] tracking-wider border-b border-indigo-100 pb-1">5. Terreno Biopsicosocial y Hábitos</h4>
                            <p><b>Cómo abrir la pregunta:</b> "¿Cómo sientes que estás durmiendo y manejando el estrés o factores que no son netamente físicos?"</p>
                            <p><b>Si responde muy general:</b> "¿Despiertas cansado? ¿Sientes mucho estrés laboral? ¿Has podido mantener un buen ritmo antes en otros tratamientos de salud?"</p>
                            <p className="text-rose-600 font-medium"><b>Qué registrar:</b> Calidad y horas de sueño crónico, red de apoyo de la que dispone, predisposición al tratamiento (ánimo, adherencia pasada) y exposición tóxica.</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <h4 className="font-bold text-indigo-800 mb-2 uppercase text-[10px] tracking-wider border-b border-indigo-100 pb-1">6. Notas Clínicas Basales</h4>
                            <p><b>Cómo abrir la pregunta:</b> (No es pregunta, sintetizas al final).</p>
                            <p><b>Si responde muy general:</b> (NA)</p>
                            <p className="text-rose-600 font-medium"><b>Qué registrar:</b> Observación del profesional. "Paciente aprehensivo, mejor explicarle visualmente", "Desafío enorme en disponibilidad de horario, enfocar plan a domicilio", etc.</p>
                        </div>
                    </div>
                </div>
            </details>

            {/* SECCION 1: HISTORIA MEDICA Y CONSIDERACIONES */}
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow duration-300">
                <div className="bg-rose-50/50 border-b border-rose-100 p-4 sm:p-5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-lg">🏥</div>
                    <h3 className="text-sm font-bold text-rose-950 uppercase tracking-widest">1. Historial Médico Clínico</h3>
                </div>
                <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="lg:col-span-2">
                        <CondicionesClinicasSelector history={history} updateNested={updateNested} isClosed={isClosed} />
                    </div>

                    <ArrayField label="Diagnósticos médicos (Texto libre u otros)" items={history.medicalHistory?.diagnoses} onChange={(v: any) => updateNested('medicalHistory', 'diagnoses', v)} placeholder="HTA, Hipotiroidismo, Cáncer..." disabled={isClosed} />
                    <ArrayField label="Farmacoterapia actual relevante" items={history.medicalHistory?.medications} onChange={(v: any) => updateNested('medicalHistory', 'medications', v)} placeholder="Losartán, Omeprazol, Anticonceptivos..." disabled={isClosed} />
                    <ArrayField label="Alergias / reacciones a medicamentos" items={history.medicalHistory?.allergies} onChange={(v: any) => updateNested('medicalHistory', 'allergies', v)} placeholder="Penicilina, AINES..." disabled={isClosed} />
                    <ArrayField label="Cirugías previas" items={history.medicalHistory?.surgeries} onChange={(v: any) => updateNested('medicalHistory', 'surgeries', v)} placeholder="Apendicectomía, Cesárea..." disabled={isClosed} />

                    <div className="lg:col-span-2">
                        <label className="block text-[10px] font-bold text-rose-800 mb-1.5 uppercase tracking-wider">
                            Detalle Clínico Relevante <span className="text-[10px] font-normal text-rose-500 bg-rose-100 px-2 py-0.5 rounded-full ml-2">Consideración clínica especial</span>
                        </label>
                        <textarea
                            value={history.medicalHistory?.clinicalConsiderations || ''}
                            onChange={e => updateNested('medicalHistory', 'clinicalConsiderations', e.target.value)}
                            disabled={isClosed}
                            placeholder="Ej. Paciente oncológico en remisión, riesgo tisular neuropático, etc."
                            className="w-full border border-rose-200 rounded-xl px-4 py-3 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-200/50 focus:outline-none min-h-[80px] bg-rose-50 border-l-4 border-l-rose-400 disabled:opacity-60 resize-y transition-shadow placeholder:text-rose-300"
                        />
                    </div>
                </div>

                {/* Sub-bloque Factores Biológicos */}
                <details className="bg-white border-t border-rose-100 group">
                    <summary className="p-4 flex items-center gap-2 cursor-pointer hover:bg-rose-50/30 text-rose-800 text-sm font-semibold select-none">
                        <svg className="w-5 h-5 text-rose-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        Factores Biológicos Relevantes (Opcional)
                    </summary>
                    <div className="p-5 pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-rose-50/10">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <input disabled={isClosed} type="checkbox" checked={history.biologicalFactors?.embarazoActual || false} onChange={e => updateNested('biologicalFactors', 'embarazoActual', e.target.checked)} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                            Embarazo actual
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <input disabled={isClosed} type="checkbox" checked={history.biologicalFactors?.postpartoReciente || false} onChange={e => updateNested('biologicalFactors', 'postpartoReciente', e.target.checked)} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                            Postparto reciente
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <input disabled={isClosed} type="checkbox" checked={history.biologicalFactors?.lactancia || false} onChange={e => updateNested('biologicalFactors', 'lactancia', e.target.checked)} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                            Lactancia
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <input disabled={isClosed} type="checkbox" checked={history.biologicalFactors?.perimenopausiaMenopausia || false} onChange={e => updateNested('biologicalFactors', 'perimenopausiaMenopausia', e.target.checked)} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                            Perimenopausia / Menopausia
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer md:col-span-2">
                            <input disabled={isClosed} type="checkbox" checked={history.biologicalFactors?.alteracionesMenstruales || false} onChange={e => updateNested('biologicalFactors', 'alteracionesMenstruales', e.target.checked)} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                            Alteraciones menstruales (relevantes para energía/carga)
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer md:col-span-2">
                            <input disabled={isClosed} type="checkbox" checked={history.biologicalFactors?.antecedentePelvico || false} onChange={e => updateNested('biologicalFactors', 'antecedentePelvico', e.target.checked)} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
                            Antecedente pélvico/ginecológico (relevante para ejercicio)
                        </label>
                        <div className="col-span-full mt-2">
                            <input disabled={isClosed} type="text" placeholder="Observación breve sobre factor biológico..." value={history.biologicalFactors?.observacion || ''} onChange={e => updateNested('biologicalFactors', 'observacion', e.target.value)} className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none bg-white placeholder:text-slate-400 shadow-sm" />
                        </div>
                    </div>
                </details>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Dominancia Lateral</label>
                                <select value={history.mskHistory?.dominancia || ''} onChange={e => updateNested('mskHistory', 'dominancia', e.target.value)} disabled={isClosed} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-400 outline-none bg-white">
                                    <option value="">Seleccione...</option>
                                    <option value="Diestro">Diestro / Derecha</option>
                                    <option value="Zurdo">Zurdo / Izquierda</option>
                                    <option value="Ambidiestro">Ambidiestro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Uso de Órtesis/Plantillas</label>
                                <input type="text" value={history.mskHistory?.usoOrtesis || ''} onChange={e => updateNested('mskHistory', 'usoOrtesis', e.target.value)} disabled={isClosed} placeholder="Sí, plantillas..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none bg-white" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Región Históricamente Problemática</label>
                            <input type="text" value={history.mskHistory?.historicalProblemRegion || ''} onChange={e => updateNested('mskHistory', 'historicalProblemRegion', e.target.value)} disabled={isClosed} placeholder="Ej: Toda la cadena posterior derecha" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none bg-white" />
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
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Recurrencias</label>
                            <textarea value={history.mskHistory?.recurrences || ''} onChange={e => updateNested('mskHistory', 'recurrences', e.target.value)} disabled={isClosed} placeholder="Atascamiento lumbar 1 vez al año..." className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50 disabled:opacity-60 h-24 resize-y" />
                        </div>
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Imágenes Preventivas / Históricas Relevantes</label>
                            <input type="text" value={history.mskHistory?.previousImaging || ''} onChange={e => updateNested('mskHistory', 'previousImaging', e.target.value)} disabled={isClosed} placeholder="RM Lumbar 2021: protrusión L4-L5 asintomática actual..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none bg-white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCION 3: DEPORTE Y CARGA BASAL */}
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
                <details className="group" open>
                    <summary className="flex justify-between items-center bg-white p-4 cursor-pointer hover:bg-emerald-50/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">🏃</div>
                            <h3 className="text-sm font-bold text-emerald-950 uppercase tracking-widest">3. Actividad Física Habitual y Carga Basal</h3>
                        </div>
                    </summary>
                    <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 border-t border-emerald-50">
                        <div className="sm:col-span-2 lg:col-span-1 border-r border-emerald-50 pr-4">
                            <label className="block text-[10px] font-bold text-emerald-800/70 mb-1.5 uppercase tracking-wider">Actividad / Deporte Central</label>
                            <input type="text" value={history.baseActivity?.primarySport || ''} onChange={e => updateNested('baseActivity', 'primarySport', e.target.value)} disabled={isClosed} placeholder="Ej. Fútbol" className="w-full border border-emerald-200/60 focus:border-emerald-400 rounded-lg text-sm px-3 py-2.5 outline-none mb-3 bg-white" />

                            <label className="block text-[10px] font-bold text-emerald-800/70 mb-1.5 uppercase tracking-wider">Categoría</label>
                            <select disabled={isClosed} value={history.baseActivity?.categoria || ''} onChange={e => updateNested('baseActivity', 'categoria', e.target.value)} className="w-full border border-emerald-200/60 rounded-lg text-sm px-3 py-2.5 outline-none bg-white">
                                <option value="">Seleccione Categoría...</option>
                                <option value="Running">Running</option>
                                <option value="Fútbol">Fútbol</option>
                                <option value="Básquetbol">Básquetbol</option>
                                <option value="Vóleibol">Vóleibol</option>
                                <option value="Crossfit / entrenamiento funcional">Crossfit / entrenamiento funcional</option>
                                <option value="Gimnasio / musculación">Gimnasio / musculación</option>
                                <option value="Ciclismo">Ciclismo</option>
                                <option value="Pádel / tenis / raqueta">Pádel / tenis / raqueta</option>
                                <option value="Artes marciales / combate">Artes marciales / combate</option>
                                <option value="Danza">Danza</option>
                                <option value="Sedentario / no practica">Sedentario / no practica</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>

                        <div className="sm:col-span-2 space-y-4">
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

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-emerald-800/70 mb-1.5 uppercase tracking-wider">Frecuencia Semanal</label>
                                    <input type="text" value={history.baseActivity?.weeklyFrequency || ''} onChange={e => updateNested('baseActivity', 'weeklyFrequency', e.target.value)} disabled={isClosed} placeholder="3 a 4 veces" className="w-full border border-emerald-200/60 rounded-lg text-sm px-3 py-2 outline-none bg-white" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-emerald-800/70 mb-1.5 uppercase tracking-wider">Duración Típica</label>
                                    <input type="text" value={history.baseActivity?.typicalDuration || ''} onChange={e => updateNested('baseActivity', 'typicalDuration', e.target.value)} disabled={isClosed} placeholder="60-90 min" className="w-full border border-emerald-200/60 rounded-lg text-sm px-3 py-2 outline-none bg-white" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-emerald-800/70 mb-1.5 uppercase tracking-wider">Experiencia Acumulada</label>
                                    <input type="text" value={history.baseActivity?.yearsExperience || ''} onChange={e => updateNested('baseActivity', 'yearsExperience', e.target.value)} disabled={isClosed} placeholder="2 años" className="w-full border border-emerald-200/60 rounded-lg text-sm px-3 py-2 outline-none bg-white" />
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-3 pt-4 border-t border-emerald-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                                <div>
                                    <label className="block text-[10px] font-bold text-emerald-800 mb-1.5 uppercase tracking-wider">Doble Carga Basal (Deporte + Trabajo/Estudio)</label>
                                    <input type="text" value={history.baseActivity?.doubleLoad || ''} onChange={e => updateNested('baseActivity', 'doubleLoad', e.target.value)} disabled={isClosed} placeholder="Ej: Trabajo físico intenso DE DÍA + Crossfit de noche" className="w-full border border-emerald-200/60 bg-white rounded-lg text-sm px-3 py-2.5 shadow-sm outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-emerald-800 mb-1.5 uppercase tracking-wider">Calendario Competitivo u Objetivo Central</label>
                                    <input type="text" value={history.baseActivity?.competitiveCalendar || ''} onChange={e => updateNested('baseActivity', 'competitiveCalendar', e.target.value)} disabled={isClosed} placeholder="Torneo el próximo mes / Mantener salud mental" className="w-full border border-emerald-200/60 bg-white rounded-lg text-sm px-3 py-2.5 shadow-sm outline-none" />
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
                        <input type="text" value={history.occupationalContext?.mainRole || ''} onChange={e => updateNested('occupationalContext', 'mainRole', e.target.value)} disabled={isClosed} placeholder="Ingeniera Civil, Teletrabajo, Mecánico Auto..." className="w-full border border-sky-200/60 rounded-lg text-sm px-4 py-2.5 outline-none shadow-sm bg-white" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-sky-800 mb-1.5 uppercase tracking-wider">Jornada / Horarios</label>
                        <select value={history.occupationalContext?.shifts || ''} onChange={e => updateNested('occupationalContext', 'shifts', e.target.value)} disabled={isClosed} className="w-full border border-sky-200/60 rounded-lg text-sm py-2.5 px-3 outline-none shadow-sm bg-white">
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
                                <select value={history.occupationalContext?.timeSitting || ''} onChange={e => updateNested('occupationalContext', 'timeSitting', e.target.value)} disabled={isClosed} className="w-full text-xs font-medium text-slate-700 bg-slate-50 border-slate-200 rounded-lg border py-2 px-3 outline-none">
                                    <option value="">--</option><option value="bajo">Casi Nulo</option><option value="medio">Mixto (2-4h)</option><option value="alto">Alto (&gt;6h continuas)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1.5">🧍 Tiempo de Pie</label>
                                <select value={history.occupationalContext?.timeStanding || ''} onChange={e => updateNested('occupationalContext', 'timeStanding', e.target.value)} disabled={isClosed} className="w-full text-xs font-medium text-slate-700 bg-slate-50 border-slate-200 rounded-lg border py-2 px-3 outline-none">
                                    <option value="">--</option><option value="bajo">Casi Nulo</option><option value="medio">Parcial / Rotativo</option><option value="alto">Estático Prolongado</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1.5">📦 Carga/Levante</label>
                                <select value={history.occupationalContext?.weightLifting || ''} onChange={e => updateNested('occupationalContext', 'weightLifting', e.target.value)} disabled={isClosed} className="w-full text-xs font-medium text-slate-700 bg-slate-50 border-slate-200 rounded-lg border py-2 px-3 outline-none">
                                    <option value="">--</option><option value="no">Nada</option><option value="ocasional">Ocasional Liviano</option><option value="frecuente_pesado">Frecuente Pesado</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-slate-600 mb-1.5">🔄 Movimiento Rept.</label>
                                <select value={history.occupationalContext?.repetitiveMovements || ''} onChange={e => updateNested('occupationalContext', 'repetitiveMovements', e.target.value)} disabled={isClosed} className="w-full text-xs font-medium text-slate-700 bg-slate-50 border-slate-200 rounded-lg border py-2 px-3 outline-none">
                                    <option value="">--</option><option value="no">Poco/Nada</option><option value="ms_sup">MMSS (Teclado, Fabrica)</option><option value="ms_inf">MMII</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-3 mt-2 lg:flex lg:gap-6 space-y-4 lg:space-y-0 items-start">
                        <div className="flex-1">
                            <MultiSelectChips
                                label="Barreras Basales Logísticas / Adherencia"
                                values={history.occupationalContext?.adherenceBarriers || []}
                                onChange={(v: any) => updateNested('occupationalContext', 'adherenceBarriers', v)}
                                disabled={isClosed}
                                options={[
                                    { label: 'Tiempo', value: 'tiempo' },
                                    { label: 'Transporte', value: 'transporte' },
                                    { label: 'Dinero', value: 'dinero' },
                                    { label: 'Turnos', value: 'turnos' },
                                    { label: 'Distancia', value: 'distancia' },
                                    { label: 'Red Apoyo', value: 'apoyo' },
                                    { label: 'Otra', value: 'otra' }
                                ]}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-sky-800 mb-1.5 uppercase tracking-wider">Exposición en trayectos / Conducción</label>
                            <input type="text" value={history.occupationalContext?.driving || ''} onChange={e => updateNested('occupationalContext', 'driving', e.target.value)} disabled={isClosed} placeholder="Maneja 2h diarias en tráfico..." className="w-full border border-sky-200/60 rounded-lg text-sm px-3 py-2 outline-none shadow-sm bg-white" />
                        </div>
                    </div>
                </div>

                <div className="bg-sky-50/20 px-5 sm:px-6 pb-6 pt-4 border-t border-sky-100">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">Contexto Domiciliario y Red de Apoyo</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-sky-50/50 p-4 border border-sky-100/60 rounded-xl">
                        <div>
                            <label className="block text-[10px] font-bold text-sky-800 mb-1.5 uppercase tracking-wider">Vive con</label>
                            <select value={history.occupationalContext?.contextoDomiciliario?.viveCon || ''} onChange={e => updateNested('occupationalContext', 'contextoDomiciliario', { ...(history.occupationalContext?.contextoDomiciliario || {}), viveCon: e.target.value })} disabled={isClosed} className="w-full border border-sky-200/60 rounded-lg text-sm py-2 px-3 outline-none bg-white">
                                <option value="">Seleccione...</option>
                                <option value="solo">Solo/a</option>
                                <option value="pareja">Pareja</option>
                                <option value="familia">Familia</option>
                                <option value="hijos">Hijos</option>
                                <option value="otros">Otros</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-sky-800 mb-1.5 uppercase tracking-wider">Red de apoyo (Tto/Ej)</label>
                            <select value={history.occupationalContext?.contextoDomiciliario?.redApoyo || ''} onChange={e => updateNested('occupationalContext', 'contextoDomiciliario', { ...(history.occupationalContext?.contextoDomiciliario || {}), redApoyo: e.target.value })} disabled={isClosed} className="w-full border border-sky-200/60 rounded-lg text-sm py-2 px-3 outline-none bg-white">
                                <option value="">Seleccione...</option>
                                <option value="si">Sí</option>
                                <option value="parcial">Parcial</option>
                                <option value="no">No</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-sky-800 mb-1.5 uppercase tracking-wider">Personas a cargo / Cuidados</label>
                            <select value={history.occupationalContext?.contextoDomiciliario?.personasACargo || ''} onChange={e => updateNested('occupationalContext', 'contextoDomiciliario', { ...(history.occupationalContext?.contextoDomiciliario || {}), personasACargo: e.target.value })} disabled={isClosed} className="w-full border border-sky-200/60 rounded-lg text-sm py-2 px-3 outline-none bg-white">
                                <option value="">Seleccione...</option>
                                <option value="no">No</option>
                                <option value="ninos">Niños</option>
                                <option value="adulto_mayor">Adulto Mayor</option>
                                <option value="otro">Otro dependiente</option>
                            </select>
                        </div>
                        <div className="md:col-span-2 lg:col-span-3">
                            <MultiSelectChips
                                label="Barreras del Domicilio / Entorno"
                                values={history.occupationalContext?.contextoDomiciliario?.barrerasEntorno || []}
                                onChange={(v: any) => updateNested('occupationalContext', 'contextoDomiciliario', { ...(history.occupationalContext?.contextoDomiciliario || {}), barrerasEntorno: v })}
                                disabled={isClosed}
                                options={[
                                    { label: 'Escaleras', value: 'escaleras' },
                                    { label: 'Traslado largo', value: 'traslado_largo' },
                                    { label: 'Zona rural/lejana', value: 'rural' },
                                    { label: 'Poco espacio en casa', value: 'espacio' },
                                    { label: 'No tiene implementos', value: 'sin_implementos' },
                                    { label: 'Otra', value: 'otra' }
                                ]}
                            />
                        </div>
                        <div className="md:col-span-2 lg:col-span-3">
                            <label className="block text-[10px] font-bold text-sky-800 mb-1.5 uppercase tracking-wider">Observación contexto domiciliario</label>
                            <input type="text" value={history.occupationalContext?.contextoDomiciliario?.observacion || ''} onChange={e => updateNested('occupationalContext', 'contextoDomiciliario', { ...(history.occupationalContext?.contextoDomiciliario || {}), observacion: e.target.value })} disabled={isClosed} placeholder="Breves anotaciones clave sobre el hogar..." className="w-full border border-sky-200/60 rounded-lg text-sm px-3 py-2 outline-none shadow-sm bg-white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCION 5: BPS Y FACTORES PROTECTORES */}
            <div className="bg-white rounded-2xl border border-amber-200/60 shadow-sm overflow-hidden">
                <details className="group" open>
                    <summary className="flex justify-between items-center bg-white p-4 cursor-pointer hover:bg-amber-50/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">🔋</div>
                            <h3 className="text-sm font-bold text-amber-950 uppercase tracking-widest">5. Terreno Biopsicosocial y Hábitos Basales</h3>
                        </div>
                    </summary>
                    <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 border-t border-amber-50">

                        <div className="space-y-6">
                            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-4">
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
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Horas Promedio</label>
                                        <input disabled={isClosed} type="text" placeholder="Ej: 6-7 hrs" value={history.bpsContext?.sueno?.horasPromedio || ''} onChange={e => updateNested('bpsContext', 'sueno', { ...(history.bpsContext?.sueno || {}), horasPromedio: e.target.value })} className="w-full text-xs p-2 rounded-lg border border-slate-200 outline-none bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Despertares nocturnos</label>
                                        <select disabled={isClosed} value={history.bpsContext?.sueno?.despertares || ''} onChange={e => updateNested('bpsContext', 'sueno', { ...(history.bpsContext?.sueno || {}), despertares: e.target.value })} className="w-full text-xs p-2 rounded-lg border border-slate-200 outline-none bg-white">
                                            <option value="">Seleccione...</option>
                                            <option value="ninguno">Ninguno</option>
                                            <option value="1">1 vez</option>
                                            <option value="2_o_mas">2 o más</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">¿Sentimiento reparador?</label>
                                        <select disabled={isClosed} value={history.bpsContext?.sueno?.reparador || ''} onChange={e => updateNested('bpsContext', 'sueno', { ...(history.bpsContext?.sueno || {}), reparador: e.target.value })} className="w-full text-xs p-2 rounded-lg border border-slate-200 outline-none bg-white">
                                            <option value="">Seleccione...</option>
                                            <option value="si">Sí</option>
                                            <option value="no">No</option>
                                            <option value="variable">Variable</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-4">
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
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mt-3 mb-1.5 uppercase tracking-wider">Fuente Principal de Estrés</label>
                                    <select disabled={isClosed} value={history.bpsContext?.estres?.fuentePrincipal || ''} onChange={e => updateNested('bpsContext', 'estres', { ...(history.bpsContext?.estres || {}), fuentePrincipal: e.target.value })} className="w-full text-xs p-2 rounded-lg border border-slate-200 outline-none bg-white">
                                        <option value="">Seleccione...</option>
                                        <option value="laboral">Laboral / Económica</option>
                                        <option value="familiar">Familiar / Pareja</option>
                                        <option value="academica">Académica</option>
                                        <option value="salud">Problemas de Salud</option>
                                        <option value="otra">Otra</option>
                                    </select>
                                </div>
                            </div>

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
                        </div>

                        <div className="space-y-6">
                            <RadioGroup
                                label="Adherencia Histórica a Tratamientos/Ejercicio"
                                value={history.bpsContext?.poorAdherenceHistory || ''}
                                onChange={(v: string) => updateNested('bpsContext', 'poorAdherenceHistory', v)}
                                disabled={isClosed}
                                options={[
                                    { label: 'Buena / Habitual', value: 'buena' },
                                    { label: 'Intermitente', value: 'intermitente' },
                                    { label: 'Baja / Suele Abandonar', value: 'baja' }
                                ]}
                            />

                            <RadioGroup
                                label="Red de Apoyo Social/Emocional Fuerte"
                                value={history.bpsContext?.socialSupport || ''}
                                onChange={(v: string) => updateNested('bpsContext', 'socialSupport', v)}
                                disabled={isClosed}
                                options={[
                                    { label: 'Fuerte apoyo', value: 'high' },
                                    { label: 'Normal / Parcial', value: 'ok' },
                                    { label: 'Aislado / Bajo', value: 'low' }
                                ]}
                            />

                            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-4">
                                <RadioGroup
                                    label="Tabaquismo"
                                    value={history.bpsContext?.smoking || ''}
                                    onChange={(v: string) => updateNested('bpsContext', 'smoking', v)}
                                    disabled={isClosed}
                                    options={[
                                        { label: 'No Fuma', value: 'no' },
                                        { label: 'Ex Fumador', value: 'ex_fumador' },
                                        { label: 'Nocturno/Social', value: 'fuma_social' },
                                        { label: 'Diario', value: 'fuma_diario' }
                                    ]}
                                />
                                {history.bpsContext?.smoking === 'fuma_diario' && (
                                    <div className="mt-3 animate-in fade-in zoom-in-95 duration-200">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Cantidad Diaria Aprox.</label>
                                        <select disabled={isClosed} value={history.bpsContext?.tabaquismo?.cantidadDiaria || ''} onChange={e => updateNested('bpsContext', 'tabaquismo', { ...(history.bpsContext?.tabaquismo || {}), cantidadDiaria: e.target.value })} className="w-full text-xs p-2 rounded-lg border border-slate-200 outline-none bg-white">
                                            <option value="">Seleccione...</option>
                                            <option value="1_5">1 a 5 diarios</option>
                                            <option value="6_10">6 a 10 diarios</option>
                                            <option value="mas_10">Más de 10 diarios</option>
                                            <option value="variable">Variable</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-4">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-amber-100/50 pb-1.5">Otros Hábitos y Nutrición</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-medium text-slate-600 mb-1">Alcohol</label>
                                        <input disabled={isClosed} type="text" placeholder="Ej: Ocasional, Diario..." value={history.bpsContext?.habitos?.alcohol || ''} onChange={e => updateNested('bpsContext', 'habitos', { ...(history.bpsContext?.habitos || {}), alcohol: e.target.value })} className="w-full text-xs p-2 rounded-lg border border-slate-200 outline-none bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-slate-600 mb-1">Cafeína</label>
                                        <input disabled={isClosed} type="text" placeholder="Ej: 3 tazas diarias" value={history.bpsContext?.habitos?.cafeina || ''} onChange={e => updateNested('bpsContext', 'habitos', { ...(history.bpsContext?.habitos || {}), cafeina: e.target.value })} className="w-full text-xs p-2 rounded-lg border border-slate-200 outline-none bg-white" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-medium text-slate-600 mb-1">Patrón de Dieta principal</label>
                                        <input disabled={isClosed} type="text" placeholder="Omnívoro balanceado, hipercalórico..." value={history.bpsContext?.habitos?.dieta || ''} onChange={e => updateNested('bpsContext', 'habitos', { ...(history.bpsContext?.habitos || {}), dieta: e.target.value })} className="w-full text-xs p-2 rounded-lg border border-slate-200 outline-none bg-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-amber-50">
                            <div>
                                <label className="block text-[10px] font-bold text-amber-800 mb-1.5 uppercase tracking-wider">Actividades Significativas / Hobbies / Bienestar</label>
                                <input type="text" value={history.bpsContext?.actividadesSignificativas || ''} onChange={e => updateNested('bpsContext', 'actividadesSignificativas', e.target.value)} disabled={isClosed} placeholder="Ej: caminar, huerto, iglesia, salir con amigos..." className="w-full border border-amber-200/60 rounded-lg text-sm px-3 py-2 outline-none shadow-sm bg-white" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-emerald-700 mb-1.5 uppercase tracking-wider">Factores Protectores a destacar</label>
                                <input type="text" value={history.bpsContext?.protectiveFactors || ''} onChange={e => updateNested('bpsContext', 'protectiveFactors', e.target.value)} disabled={isClosed} placeholder="Ex-deportista pro, altísima resiliencia..." className="w-full border border-emerald-200/60 bg-emerald-50/50 rounded-lg text-sm px-3 py-2 outline-none shadow-sm text-emerald-900" />
                            </div>
                        </div>
                    </div>
                </details>
            </div>

            {/* SECCION 6: NOTAS BASALES */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <details className="group" open>
                    <summary className="flex justify-between items-center bg-white p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">📝</div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">6. Notas Clínicas Basales Relevantes</h3>
                        </div>
                    </summary>
                    <div className="p-5 sm:p-6 border-t border-slate-100">
                        <textarea
                            value={history.permanentNotes || ''}
                            onChange={e => handleChange({ ...history, permanentNotes: e.target.value })}
                            disabled={isClosed}
                            placeholder="Construye un relato macro del paciente en el tiempo. Ej: 'Paciente aprehensivo respecto a su hombro tras caída en 2011. Mejor canal de enseñanza: cinestésico.' NO uses este espacio para dolor actual."
                            className="w-full border border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-4 text-[14px] min-h-[120px] resize-y leading-relaxed outline-none shadow-inner bg-slate-50/50"
                        />
                    </div>
                </details>
            </div>

            {/* FOOTER ESPACIADOR */}
            <div className="h-10"></div>
        </div>
    );
}
