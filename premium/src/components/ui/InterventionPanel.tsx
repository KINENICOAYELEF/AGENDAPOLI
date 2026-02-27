import React, { useState } from 'react';
import { InterventionRecord } from '../../types/clinica';
import { NumericStepper } from './NumericStepper';
import { PlusIcon, TrashIcon } from '@heroicons/react/20/solid';

const INTERVENTION_CATEGORIES = [
    'Educación',
    'Terapia manual',
    'Modalidades físicas',
    'Vendaje/soporte',
    'Exposición/retorno',
    'Respiratorio/relajación',
    'Otras'
];

interface InterventionPanelProps {
    interventions: InterventionRecord[] | { categories: string[], notes: string };
    onChange: (newInterventions: InterventionRecord[]) => void;
    disabled?: boolean;
}

export function InterventionPanel({ interventions, onChange, disabled }: InterventionPanelProps) {
    // Manejo de backward compatibility (Si recibimos el formato viejo, lo tratamos como un record vacío o migrado)
    const currentList: InterventionRecord[] = Array.isArray(interventions)
        ? interventions
        : (interventions?.notes ? [{ id: 'legacy-1', type: 'Otras', note: `[Legacy] ${interventions.notes}` }] : []);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const handleAddIntervention = (type: string) => {
        if (disabled) return;
        const newRecord: InterventionRecord = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2),
            type,
            doseValue: '',
            doseUnit: 'min',
            region: '',
            intensity: '',
            note: ''
        };
        onChange([...currentList, newRecord]);
        setSelectedCategory(null); // Resetea la categoría seleccionada al añadir
    };

    const handleRemove = (id: string) => {
        if (disabled) return;
        onChange(currentList.filter(rec => rec.id !== id));
    };

    const updateRecord = (id: string, field: keyof InterventionRecord, value: string) => {
        if (disabled) return;
        onChange(currentList.map(rec => rec.id === id ? { ...rec, [field]: value } : rec));
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Lista de Intervenciones Activas */}
            {currentList.length > 0 && (
                <div className="flex flex-col gap-3">
                    {currentList.map((rec) => (
                        <div key={rec.id} className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4 relative group">
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-xs font-black text-amber-800 uppercase tracking-widest bg-amber-200/50 px-2.5 py-1 rounded-md">
                                    {rec.type}
                                </span>
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(rec.id)}
                                        className="text-amber-400 hover:text-rose-500 transition-colors p-1"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                <div className="col-span-1 md:col-span-3">
                                    <NumericStepper
                                        label="Dosis"
                                        placeholder="Valor"
                                        value={rec.doseValue || ""}
                                        onChange={(val) => updateRecord(rec.id, 'doseValue', val)}
                                        disabled={disabled}
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-3">
                                    <label className="block text-[9px] font-bold text-amber-700/70 mb-1 ml-1 uppercase">Unidad</label>
                                    <select
                                        disabled={disabled}
                                        value={rec.doseUnit || "min"}
                                        onChange={(e) => updateRecord(rec.id, 'doseUnit', e.target.value)}
                                        className="w-full bg-white border border-amber-200 rounded-xl px-3 h-11 text-sm font-bold text-slate-700 outline-none focus:border-amber-400 transition-all"
                                    >
                                        <option value="min">Minutos</option>
                                        <option value="series">Series</option>
                                        <option value="rep">Reps</option>
                                        <option value="hz">Hz</option>
                                        <option value="w">Watts</option>
                                        <option value="otro">Otro</option>
                                    </select>
                                </div>
                                <div className="col-span-1 md:col-span-6">
                                    <label className="block text-[9px] font-bold text-amber-700/70 mb-1 ml-1 uppercase">Zona Corporal</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Hombro derecho"
                                        disabled={disabled}
                                        value={rec.region || ""}
                                        onChange={(e) => updateRecord(rec.id, 'region', e.target.value)}
                                        className="w-full bg-white border border-amber-200 rounded-xl px-3 h-11 text-sm font-bold text-slate-700 outline-none focus:border-amber-400 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-3">
                                    <label className="block text-[9px] font-bold text-amber-700/70 mb-1 ml-1 uppercase">Intensidad</label>
                                    <input
                                        type="text"
                                        placeholder="Baja/Media/Alta"
                                        disabled={disabled}
                                        value={rec.intensity || ""}
                                        onChange={(e) => updateRecord(rec.id, 'intensity', e.target.value)}
                                        className="w-full bg-white border border-amber-200 rounded-xl px-3 h-11 text-sm font-bold text-slate-700 outline-none focus:border-amber-400 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-9">
                                    <label className="block text-[9px] font-bold text-amber-700/70 mb-1 ml-1 uppercase">Nota Corta</label>
                                    <input
                                        type="text"
                                        placeholder="Observación rápida..."
                                        disabled={disabled}
                                        value={rec.note || ""}
                                        onChange={(e) => updateRecord(rec.id, 'note', e.target.value)}
                                        className="w-full bg-white border border-amber-200 rounded-xl px-3 h-11 text-sm font-bold text-slate-700 outline-none focus:border-amber-400 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Selector de Nueva Intervención */}
            {!disabled && (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center mt-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Añadir Intervención Clínica</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {INTERVENTION_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => handleAddIntervention(cat)}
                                className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-black hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                            >
                                <PlusIcon className="w-3.5 h-3.5 opacity-70" />
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
