// @ts-nocheck

import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { PersonaUsuaria, RemoteHistory } from "@/types/personaUsuaria";

// Componente helper para arrays simples
const ArrayField = ({ label, items, onChange, placeholder }: any) => (
    <div className="mb-4">
        <label className="block text-xs font-bold text-slate-700 mb-1.5">{label}</label>
        <input
            type="text"
            value={items.map((i: any) => i.name).join(', ')}
            onChange={e => {
                const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                onChange(arr.map(name => ({ name })));
            }}
            placeholder={placeholder}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 outline-none bg-slate-50"
        />
    </div>
);

interface M3Props {
    usuariaId: string;
    isDrawerMode?: boolean;
}

export function M3_PerfilPermanente({ usuariaId, isDrawerMode = false }: M3Props) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Default Empty State for Strict Schema
    const [history, setHistory] = useState<any>({
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
    });

    useEffect(() => {
        if (!globalActiveYear || !usuariaId) return;
        const fetchPerson = async () => {
            try {
                const docRef = doc(db, "programs", globalActiveYear, "personas", usuariaId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {

                    const data = docSnap.data() as PersonaUsuaria;
                    if (data.remoteHistory) {
                        // Merge with default to ensure no missing nested objects crash the UI
                        setHistory((prev: any) => ({
                            ...prev,
                            ...data.remoteHistory,
                            physicalActivity: { ...prev.physicalActivity, ...(data.remoteHistory?.physicalActivity || {}) },
                            occupationDemands: { ...prev.occupationDemands, ...(data.remoteHistory?.occupationDemands || {}) },
                            sleep: { ...prev.sleep, ...(data.remoteHistory?.sleep || {}) },
                            stressMood: { ...prev.stressMood, ...(data.remoteHistory?.stressMood || {}) },
                            logistics: { ...prev.logistics, ...(data.remoteHistory?.logistics || {}) },
                            preferences: { ...prev.preferences, ...(data.remoteHistory?.preferences || {}) },
                        }));
                    }
                }
            } catch (error) {
                console.error("Error fetching remote history:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPerson();
    }, [globalActiveYear, usuariaId]);

    const handleSave = async () => {
        if (!globalActiveYear || !usuariaId) return;
        setSaving(true);
        try {
            const docRef = doc(db, "programs", globalActiveYear, "personas", usuariaId);
            const updatedHistory = {
                ...history,
                lastUpdated: new Date().toISOString(),
                updatedByClinician: user?.email || 'Desconocido'
            };
            await setDoc(docRef, { remoteHistory: updatedHistory }, { merge: true });
            setHistory(updatedHistory);
            alert("Perfil Permanente estructurado actualizado exitosamente.");
        } catch (error) {
            console.error(error);
            alert("Error al actualizar el perfil.");
        } finally {
            setSaving(false);
        }
    };

    const updateNested = (category: keyof RemoteHistory, field: string, value: any) => {
        setHistory((prev: any) => ({
            ...prev,
            [category]: {
                ...(prev[category] as any),
                [field]: value
            }
        }));
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando perfil base...</div>;
    }

    return (
        <div className={`space-y-6 pb-20 ${!isDrawerMode ? 'animate-in fade-in zoom-in-95 duration-300' : ''}`}>
            {!isDrawerMode && (
                <div className="flex items-center gap-3 mb-2 px-1">
                    <span className="text-2xl">📇</span>
                    <div>
                        <h3 className="text-lg font-black text-slate-800">M3: Perfil Permanente (Remote History)</h3>
                        <p className="text-xs text-slate-500 font-medium">Anamnesis remota estructurada y transversal al expediente.</p>
                    </div>
                </div>
            )}

            <div className={`bg-white border-slate-200 shadow-sm ${isDrawerMode ? 'px-1' : 'border rounded-2xl p-5 md:p-6'}`}>

                {/* BLOQUE MEDICO */}
                <details className="group mb-4" open>
                    <summary className="flex justify-between items-center font-bold text-indigo-900 cursor-pointer list-none bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                        <span className="flex items-center gap-2">🏥 Historial Médico Clínico</span>
                        <span className="transition group-open:rotate-180">▼</span>
                    </summary>
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2">
                        {/* Simplificación de Comorbilidades para UX Rapida */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">Comorbilidades Crónicas (Ej. HTA: controlada, DM2)</label>
                            <input type="text" value={history.comorbidities.map(c => c.name).join(', ')} onChange={e => {
                                const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                                setHistory((prev: any) => ({ ...prev, comorbidities: arr.map(name => ({ name, status: 'unknown', severity: 'med', clinicalConsiderations: '' })) }));
                            }} placeholder="HTA, DM2, Hipotiroidismo..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">Cirugías Previas</label>
                            <input type="text" value={history.surgeries.map(s => s.name).join(', ')} onChange={e => {
                                const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                                setHistory((prev: any) => ({ ...prev, surgeries: arr.map(name => ({ name, dateApprox: '', sequelae: '' })) }));
                            }} placeholder="LCA Derecha 2018, Apendicectomía..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                        </div>

                        <ArrayField label="Fármacos y Suplementos" items={history.medications} onChange={(val: any) => setHistory((p: any) => ({ ...p, medications: val }))} placeholder="Eutirox, Losartán, Creatina..." />
                        <ArrayField label="Alergias / RAMs" items={history.allergies} onChange={(val: any) => setHistory((p: any) => ({ ...p, allergies: val }))} placeholder="Penicilina, Ibuprofeno..." />
                    </div>
                </details>

                {/* BLOQUE ALOSTATICO & BPS */}
                <details className="group mb-4">
                    <summary className="flex justify-between items-center font-bold text-amber-800 cursor-pointer list-none bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                        <span className="flex items-center gap-2">🔋 Carga Alostática, Sueño y Estrés</span>
                        <span className="transition group-open:rotate-180">▼</span>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">Calidad de Sueño</label>
                            <select value={history.sleep.quality} onChange={e => updateNested('sleep', 'quality', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="poor">🔴 Pobre / Malo</option>
                                <option value="ok">🟡 Regular / OK</option>
                                <option value="good">🟢 Bueno / Reparador</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">Horas Promedio</label>
                            <input type="number" value={history.sleep.hoursAvg} onChange={e => updateNested('sleep', 'hoursAvg', Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">Nivel de Estrés</label>
                            <select value={history.stressMood.stressLevel} onChange={e => updateNested('stressMood', 'stressLevel', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="high">🔴 Alto (Sobrecarga)</option>
                                <option value="med">🟡 Medio (Manejable)</option>
                                <option value="low">🟢 Bajo</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">Estado de Ánimo General</label>
                            <select value={history.stressMood.mood} onChange={e => updateNested('stressMood', 'mood', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="low">🔴 Bajo / Depresivo</option>
                                <option value="ok">🟡 Estable / OK</option>
                                <option value="high">🟢 Alto / Positivo</option>
                            </select>
                        </div>
                    </div>
                </details>

                {/* BLOQUE LABORAL Y ACTIVIDAD */}
                <details className="group mb-4">
                    <summary className="flex justify-between items-center font-bold text-emerald-800 cursor-pointer list-none bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                        <span className="flex items-center gap-2">🏃 Actividad Física y Trabajo</span>
                        <span className="transition group-open:rotate-180">▼</span>
                    </summary>
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Deporte o Actividad Física Principal</label>
                                <input type="text" value={history.physicalActivity.type} onChange={e => updateNested('physicalActivity', 'type', e.target.value)} placeholder="Ej. Voleibol, CrossFit, Trote..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Frecuencia Semanal</label>
                                <input type="text" value={history.physicalActivity.frequency} onChange={e => updateNested('physicalActivity', 'frequency', e.target.value)} placeholder="Ej. 3x semana" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Ocupación / Trabajo</label>
                                <input type="text" value={history.occupationDemands.type} onChange={e => updateNested('occupationDemands', 'type', e.target.value)} placeholder="Ej. Oficinista, Construcción, Conductor..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {['standing', 'sitting', 'lifting', 'repetitive'].map(key => (
                                <label key={key} className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                                    <input type="checkbox" checked={!!(history.occupationDemands as any)[key]} onChange={e => updateNested('occupationDemands', key, e.target.checked)} />
                                    {key === 'standing' ? 'De pie prolg.' : key === 'sitting' ? 'Sedente prolg.' : key === 'lifting' ? 'Carga pesos' : 'Mov. Repetitivos'}
                                </label>
                            ))}
                        </div>
                    </div>
                </details>


                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[10px] text-slate-400">
                        Última actualización: {history.lastUpdated ? new Date(history.lastUpdated).toLocaleDateString() : 'Nunca'} por {history.updatedByClinician}
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Fijar Perfil Remoto'}
                    </button>
                </div>

            </div>
        </div>
    );
}
