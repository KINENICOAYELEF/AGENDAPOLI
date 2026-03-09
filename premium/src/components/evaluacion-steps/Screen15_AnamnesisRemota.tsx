import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { RemoteHistory, PersonaUsuaria } from "@/types/personaUsuaria";
import { BaseEvaluacion } from "@/types/clinica";

// Componente helper para arrays de tags (Comorbilidades, Fármacos, etc.)
const ArrayField = ({ label, items, onChange, placeholder, disabled }: any) => (
    <div className="mb-4">
        <label className="block text-xs font-bold text-slate-700 mb-1.5">{label}</label>
        <input
            type="text"
            value={items?.map((i: any) => i.name).join(', ') || ''}
            onChange={e => {
                const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                onChange(arr.map(name => ({ name })));
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 outline-none bg-slate-50 disabled:opacity-60 disabled:bg-slate-100"
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
    const [saving, setSaving] = useState(false);

    // Estado local para la edición interactiva
    const [history, setHistory] = useState<RemoteHistory>(
        formData.remoteHistorySnapshot || {
            comorbidities: [],
            surgeries: [],
            medications: [],
            allergies: [],
            relevantInjuryHistory: [],
            physicalActivity: { type: '', frequency: '', level: '', goals: '' },
            occupationDemands: { type: '', standing: false, sitting: false, lifting: false, repetitive: false, shifts: false, notes: '' },
            sleep: { hoursAvg: 7, quality: 'ok', awakenings: 0, notes: '' },
            stressMood: { stressLevel: 'med', mood: 'ok', notes: '' },
            logistics: { timeBarrier: false, transportBarrier: false, gymAccess: false, equipmentAccess: false, other: '' },
            preferences: { likes: '', dislikes: '', schedulePreference: '', adherenceHistory: '' },
            permanentNotes: '',
            lastUpdated: new Date().toISOString(),
            updatedByClinician: user?.email || 'Desconocido'
        }
    );

    // Hidratación Inicial: Si no hay Snapshot en la evaluación, cargamos el global del Paciente
    useEffect(() => {
        if (formData.remoteHistorySnapshot) return; // Si ya hay snapshot guardado, no sobreescribir con base de datos
        if (!globalActiveYear || !usuariaId) return;

        const fetchPerson = async () => {
            try {
                const docRef = doc(db, "programs", globalActiveYear, "personas", usuariaId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as PersonaUsuaria;
                    if (data.remoteHistory) {
                        const mergedHistory = {
                            ...history,
                            ...data.remoteHistory,
                            physicalActivity: { ...history.physicalActivity, ...(data.remoteHistory?.physicalActivity || {}) },
                            occupationDemands: { ...history.occupationDemands, ...(data.remoteHistory?.occupationDemands || {}) },
                            sleep: { ...history.sleep, ...(data.remoteHistory?.sleep || {}) },
                            stressMood: { ...history.stressMood, ...(data.remoteHistory?.stressMood || {}) },
                            logistics: { ...history.logistics, ...(data.remoteHistory?.logistics || {}) },
                            preferences: { ...history.preferences, ...(data.remoteHistory?.preferences || {}) },
                        };
                        setHistory(mergedHistory);
                        updateFormData({ remoteHistorySnapshot: mergedHistory }); // Auto-sincroniza borrador
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

    // Handle Local Change -> auto sync to Assessment form data
    const handleChange = (newHistory: RemoteHistory) => {
        setHistory(newHistory);
        updateFormData({ remoteHistorySnapshot: newHistory });
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

    // Botón manual opcional para guardar en Ficha si se edita en Reevaluación DRAFT
    const handleSyncToPersona = async () => {
        if (!globalActiveYear || !usuariaId || isClosed) return;
        setSaving(true);
        try {
            const docRef = doc(db, "programs", globalActiveYear, "personas", usuariaId);
            const updatedHistory = {
                ...history,
                lastUpdated: new Date().toISOString(),
                updatedByClinician: user?.email || 'Desconocido'
            };
            await setDoc(docRef, { remoteHistory: updatedHistory }, { merge: true });
            handleChange(updatedHistory);
            alert("✅ Perfil Global de Paciente actualizado. Esta pantalla (P1.5) también conservará esta versión al cerrarse.");
        } catch (error) {
            console.error(error);
            alert("Error al sincronizar el perfil base.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500 animate-pulse">Consultando ficha global base...</div>;
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* CABECERA GESTION */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div>
                    <h2 className="text-lg font-black text-indigo-900 flex items-center gap-2">
                        <span className="text-xl leading-none">📇</span>
                        P1.5: Anamnesis Remota
                    </h2>
                    <p className="text-indigo-700/80 text-xs font-medium md:max-w-xl mt-1 leading-relaxed">
                        Captura estructurada de antecedentes basales. Las modificaciones aquí no solo documentan la sesión actual, sino que conforman el <b>Perfil Permanente</b> para futuras reevaluaciones.
                    </p>
                </div>
                {!isClosed && (
                    <button
                        onClick={handleSyncToPersona}
                        disabled={saving}
                        className="bg-white text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                        {saving ? 'Sincronizando...' : 'Sincronizar Oficialmente'}
                    </button>
                )}
            </div>

            {/* SECCION 1: HISTORIA MEDICA */}
            <details className="group" open>
                <summary className="flex justify-between items-center font-bold text-slate-800 cursor-pointer list-none bg-white p-3.5 px-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                    <span className="flex items-center gap-2 text-[13px] uppercase tracking-wide">🏥 Historial Médico Clínico</span>
                    <span className="transition duration-300 group-open:rotate-180 text-slate-400">▼</span>
                </summary>
                <div className="p-4 bg-white border border-t-0 border-slate-200 rounded-b-xl -mt-2 pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Comorbilidades Crónicas</label>
                        <input
                            type="text"
                            value={history.comorbidities?.map(c => c.name).join(', ') || ''}
                            onChange={e => {
                                const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                                handleChange({ ...history, comorbidities: arr.map(name => ({ name, status: 'unknown', severity: 'med', clinicalConsiderations: '' })) });
                            }}
                            placeholder="Ej: Diabetes Tipo 2, Hipotiroidismo, Artritis..."
                            disabled={isClosed}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 disabled:opacity-60 bg-slate-50"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Cirugías Previas</label>
                        <input
                            type="text"
                            value={history.surgeries?.map(s => s.name).join(', ') || ''}
                            onChange={e => {
                                const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                                handleChange({ ...history, surgeries: arr.map(name => ({ name, dateApprox: '', sequelae: '' })) });
                            }}
                            placeholder="Ej: LCA Rodilla Derecha 2018, Apendicectomía..."
                            disabled={isClosed}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 disabled:opacity-60 bg-slate-50"
                        />
                    </div>
                    <ArrayField label="Fármacos y Suplementos Actuales" items={history.medications} onChange={(val: any) => handleChange({ ...history, medications: val })} placeholder="Ej: Losartán 50mg, Levotiroxina, Whey Protein" disabled={isClosed} />
                    <ArrayField label="Alergias / RAMs Reales" items={history.allergies} onChange={(val: any) => handleChange({ ...history, allergies: val })} placeholder="Ej: Penicilina, AINES..." disabled={isClosed} />
                </div>
            </details>

            {/* SECCION 2: BPS (Sueño, Estrés, Hábitos) */}
            <details className="group">
                <summary className="flex justify-between items-center font-bold text-amber-900 cursor-pointer list-none bg-amber-50 p-3.5 px-4 rounded-xl border border-amber-200 shadow-sm hover:bg-amber-100/50 transition-colors">
                    <span className="flex items-center gap-2 text-[13px] uppercase tracking-wide">🔋 Factores Basales BPS (Sueño y Estrés)</span>
                    <span className="transition duration-300 group-open:rotate-180 text-amber-400">▼</span>
                </summary>
                <div className="p-4 bg-white border border-t-0 border-amber-100 rounded-b-xl -mt-2 pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">Calidad Sueño</label>
                        <select
                            value={history.sleep?.quality || 'ok'}
                            onChange={e => updateNested('sleep', 'quality', e.target.value)}
                            disabled={isClosed}
                            className="w-full border-slate-300 rounded-lg text-sm bg-slate-50 disabled:opacity-60"
                        >
                            <option value="poor">🔴 Mala / Reparación Mín.</option>
                            <option value="ok">🟡 Regular / Inconstante</option>
                            <option value="good">🟢 Buena / Reparadora</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">Horas Promedio</label>
                        <input
                            type="number"
                            value={history.sleep?.hoursAvg || ''}
                            onChange={e => updateNested('sleep', 'hoursAvg', Number(e.target.value))}
                            disabled={isClosed}
                            placeholder="Ej: 7"
                            className="w-full border-slate-300 rounded-lg text-sm bg-slate-50 px-3 py-2 disabled:opacity-60"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">Estrés Basal</label>
                        <select
                            value={history.stressMood?.stressLevel || 'med'}
                            onChange={e => updateNested('stressMood', 'stressLevel', e.target.value)}
                            disabled={isClosed}
                            className="w-full border-slate-300 rounded-lg text-sm bg-slate-50 disabled:opacity-60"
                        >
                            <option value="high">🔴 Alto (Sobrecarga Cte)</option>
                            <option value="med">🟡 Medio (Manejable)</option>
                            <option value="low">🟢 Bajo o Sin Problemas</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">Ánimo / Soporte</label>
                        <select
                            value={history.stressMood?.mood || 'ok'}
                            onChange={e => updateNested('stressMood', 'mood', e.target.value)}
                            disabled={isClosed}
                            className="w-full border-slate-300 rounded-lg text-sm bg-slate-50 disabled:opacity-60"
                        >
                            <option value="low">🔴 Bajo o Factores Naranja</option>
                            <option value="ok">🟡 Estable</option>
                            <option value="high">🟢 Positivo / Red Fuerte</option>
                        </select>
                    </div>
                </div>
            </details>

            {/* SECCION 3: ACTIVIDAD FISICA Y LABORAL */}
            <details className="group">
                <summary className="flex justify-between items-center font-bold text-emerald-900 cursor-pointer list-none bg-emerald-50 p-3.5 px-4 rounded-xl border border-emerald-200 shadow-sm hover:bg-emerald-100/50 transition-colors">
                    <span className="flex items-center gap-2 text-[13px] uppercase tracking-wide">🏃 Deporte y Ocupación</span>
                    <span className="transition duration-300 group-open:rotate-180 text-emerald-400">▼</span>
                </summary>
                <div className="p-4 bg-white border border-t-0 border-emerald-100 rounded-b-xl -mt-2 pt-5 space-y-5">
                    {/* Deporte */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">Actividad o Deporte Principal</label>
                            <input
                                type="text"
                                value={history.physicalActivity?.type || ''}
                                onChange={e => updateNested('physicalActivity', 'type', e.target.value)}
                                disabled={isClosed}
                                placeholder="Pádel, Running amateur, Sedentario..."
                                className="w-full border-slate-300 rounded-lg text-sm px-3 py-2 bg-slate-50 disabled:opacity-60"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">Frecuencia Habitual</label>
                            <input
                                type="text"
                                value={history.physicalActivity?.frequency || ''}
                                onChange={e => updateNested('physicalActivity', 'frequency', e.target.value)}
                                disabled={isClosed}
                                placeholder="Ej: 3 veces por semana x 60 min"
                                className="w-full border-slate-300 rounded-lg text-sm px-3 py-2 bg-slate-50 disabled:opacity-60"
                            />
                        </div>
                    </div>
                    {/* Laboral */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">Ocupación / Demandas Laborales</label>
                        <input
                            type="text"
                            value={history.occupationDemands?.type || ''}
                            onChange={e => updateNested('occupationDemands', 'type', e.target.value)}
                            disabled={isClosed}
                            placeholder="Oficinista remota, Obrero, Profe de Educación Física..."
                            className="w-full border-slate-300 rounded-lg text-sm px-3 py-2 bg-slate-50 disabled:opacity-60"
                        />
                        <div className="flex flex-wrap gap-2 mt-3">
                            {['standing', 'sitting', 'lifting', 'repetitive', 'shifts'].map(key => (
                                <label key={key} className={`flex items-center gap-1.5 text-xs font-medium border rounded-full px-3 py-1 cursor-pointer transition-colors ${!!(history.occupationDemands as any)[key] ? 'bg-emerald-100 border-emerald-300 text-emerald-800 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                    <input type="checkbox" className="sr-only" disabled={isClosed} checked={!!(history.occupationDemands as any)[key]} onChange={e => updateNested('occupationDemands', key, e.target.checked)} />
                                    {key === 'standing' ? '🧍 De Pie' : key === 'sitting' ? '🪑 Sedente' : key === 'lifting' ? '📦 Carga Pesos' : key === 'repetitive' ? '🔄 Mov. Repetitivos' : '🌗 Turnos Noche'}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </details>

            {/* SECCION FINAL: MSK HISTÓRICO Y NOTAS GLOBALES (Reemplazo relato antiguo) */}
            <details className="group">
                <summary className="flex justify-between items-center font-bold text-slate-800 cursor-pointer list-none bg-white p-3.5 px-4 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors">
                    <span className="flex items-center gap-2 text-[13px] uppercase tracking-wide">📂 Lesiones Previas (MSK) y Notas del Expediente</span>
                    <span className="transition duration-300 group-open:rotate-180 text-slate-400">▼</span>
                </summary>
                <div className="p-4 bg-white border border-t-0 border-slate-200 rounded-b-xl -mt-2 pt-5">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Registro Base de Previas y Consideraciones</label>
                    <textarea
                        value={history.permanentNotes || ''}
                        onChange={e => handleChange({ ...history, permanentNotes: e.target.value })}
                        disabled={isClosed}
                        placeholder="Usa este espacio para registrar episodios de lumbalgia cronificados desde 2018, esguinces de tobillo mal curados, o barreras contextuales como 'Paciente vive lejos, asiste solo jueves'."
                        className="w-full border-slate-300 rounded-xl px-3 py-3 text-sm focus:border-indigo-400 min-h-[120px] resize-y leading-relaxed bg-slate-50 disabled:opacity-60"
                        style={{ fontSize: "16px" }}
                    />
                </div>
            </details>

        </div>
    );
}
