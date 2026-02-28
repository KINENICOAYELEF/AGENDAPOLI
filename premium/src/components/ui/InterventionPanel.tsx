import React, { useState } from 'react';
import { InterventionRecord } from '../../types/clinica';
import { PlusIcon, TrashIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '@heroicons/react/20/solid';

const INTERVENTION_CATEGORIES = [
    'Educación',
    'Terapia manual',
    'Modalidades físicas',
    'Vendaje/soporte',
    'Exposición/retorno',
    'Respiratorio/relajación',
    'Otras'
] as const;

const SUBTYPES_BY_CATEGORY: Record<string, string[]> = {
    'Educación': ['Neurociencia del dolor', 'Manejo de cargas', 'Auto-manejo de crisis', 'Ergonomía', 'Otro'],
    'Terapia manual': ['Movilización articular', 'Manipulación Thrust', 'Masoterapia', 'Punción Seca', 'Otro'],
    'Modalidades físicas': ['TENS/Electroanalgesia', 'Termoterapia (Calor)', 'Crioterapia (Frío)', 'Ultrasonido', 'Ondas de Choque', 'Otro'],
    'Vendaje/soporte': ['Kinesiotaping', 'Vendaje Rígido/McConnell', 'Órtesis', 'Otro'],
    'Exposición/retorno': ['Exposición gradual In Vivo', 'Simulación gesto deportivo', 'Otro'],
    'Respiratorio/relajación': ['Respiración diafragmática', 'Relajación progresiva', 'Otro'],
    'Otras': ['Otro']
};

interface InterventionPanelProps {
    interventions: InterventionRecord[] | { categories: string[], notes: string };
    onChange: (newInterventions: InterventionRecord[]) => void;
    activeObjectives?: { id: string, label: string }[];
    disabled?: boolean;
}

export function InterventionPanel({ interventions, onChange, activeObjectives = [], disabled }: InterventionPanelProps) {
    // Modo borrador para el "mini panel" (estricto como pide el usuario)
    const [draft, setDraft] = useState<InterventionRecord | null>(null);

    const currentList: InterventionRecord[] = (() => {
        if (Array.isArray(interventions)) {
            return interventions.map((i: any) => ({
                id: i.id || Date.now().toString(36) + Math.random().toString(36).substring(2),
                category: i.category || (INTERVENTION_CATEGORIES.includes(i.type as any) ? i.type : 'Otras'),
                subType: i.subType || i.region || 'Especificar...',
                dose: i.dose || i.doseValue ? `${i.doseValue || ''} ${i.doseUnit || ''}`.trim() : '',
                intensity: ['Baja', 'Media', 'Alta'].includes(i.intensity) ? i.intensity : undefined,
                notes: i.notes || i.note || '',
                objectiveIds: i.objectiveIds || []
            }));
        } else if (interventions?.categories) {
            return interventions.categories.map(cat => ({
                id: Date.now().toString(36) + Math.random().toString(36).substring(2),
                category: (INTERVENTION_CATEGORIES.includes(cat as any) ? cat : 'Otras') as any,
                subType: 'Legado Genérico',
                notes: interventions.notes || ''
            }));
        }
        return [];
    })();

    const handleOpenDraft = (category: typeof INTERVENTION_CATEGORIES[number]) => {
        if (disabled) return;
        setDraft({
            id: Date.now().toString(36) + Math.random().toString(36).substring(2),
            category,
            subType: SUBTYPES_BY_CATEGORY[category][0] || 'Otro',
            dose: '',
            intensity: 'Media',
            notes: '',
            objectiveIds: []
        });
    };

    const handleEditDraft = (record: InterventionRecord) => {
        if (disabled) return;
        setDraft({ ...record });
    };

    const handleSaveDraft = () => {
        if (!draft) return;

        // Verifica si ya existe (edición) o es nuevo
        const isEditing = currentList.some(r => r.id === draft.id);
        if (isEditing) {
            onChange(currentList.map(rec => rec.id === draft.id ? draft : rec));
        } else {
            onChange([...currentList, draft]);
        }
        setDraft(null); // Cierra el mini-panel
    };

    const handleRemove = (id: string) => {
        if (disabled) return;
        onChange(currentList.filter(rec => rec.id !== id));
    };

    return (
        <div className="flex flex-col gap-4">

            {/* MINI PANEL DE CREACIÓN / EDICIÓN (Abre al tocar categoría o editar) */}
            {draft && (
                <div className="bg-amber-50 border-2 border-amber-300 shadow-md rounded-2xl p-5 relative transition-all animate-in fade-in zoom-in duration-200">
                    <div className="flex justify-between items-center mb-4 border-b border-amber-200/50 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                            <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                                {currentList.some(r => r.id === draft.id) ? 'Editando' : 'Agregando'} <span className="text-amber-600">{draft.category}</span>
                            </h4>
                        </div>
                        <button onClick={() => setDraft(null)} className="text-amber-400 hover:text-rose-500 p-1 rounded-full hover:bg-white transition-all">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-4">
                        {/* SubTipo */}
                        <div className="col-span-1 md:col-span-6">
                            <label className="block text-[10px] font-bold text-amber-800 mb-1.5 uppercase">Técnica / Subtipo</label>
                            <select
                                value={draft.subType}
                                onChange={(e) => setDraft({ ...draft, subType: e.target.value })}
                                className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all shadow-sm"
                            >
                                {SUBTYPES_BY_CATEGORY[draft.category]?.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                                {!SUBTYPES_BY_CATEGORY[draft.category]?.includes(draft.subType) && draft.subType !== 'Otro' && draft.subType !== '' && (
                                    <option value={draft.subType}>{draft.subType}</option>
                                )}
                                <option value="Otro">Escribir Manualmente (Otro)</option>
                            </select>
                            {draft.subType === 'Otro' && (
                                <input
                                    type="text"
                                    placeholder="Detalle la técnica..."
                                    autoFocus
                                    className="mt-2 w-full border border-amber-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                                    onChange={(e) => setDraft({ ...draft, subType: e.target.value })}
                                />
                            )}
                        </div>

                        {/* Dosis y Intensidad */}
                        <div className="col-span-1 md:col-span-3">
                            <label className="block text-[10px] font-bold text-amber-800 mb-1.5 uppercase">Dosis (Opcional)</label>
                            <input
                                type="text"
                                placeholder="Ej: 15 min, 3x10"
                                value={draft.dose || ""}
                                onChange={(e) => setDraft({ ...draft, dose: e.target.value })}
                                className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 shadow-sm transition-all"
                            />
                        </div>
                        <div className="col-span-1 md:col-span-3">
                            <label className="block text-[10px] font-bold text-amber-800 mb-1.5 uppercase">Intensidad</label>
                            <select
                                value={draft.intensity || ""}
                                onChange={(e) => setDraft({ ...draft, intensity: e.target.value as any })}
                                className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 shadow-sm transition-all"
                            >
                                <option value="">--</option>
                                <option value="Baja">Baja</option>
                                <option value="Media">Media</option>
                                <option value="Alta">Alta</option>
                            </select>
                        </div>

                        {/* Nota Larga */}
                        <div className="col-span-1 md:col-span-12">
                            <div className="flex justify-between items-end mb-1.5">
                                <label className="block text-[10px] font-bold text-amber-800 uppercase">Nota Corta (Máx 200)</label>
                                <span className={`text-[10px] font-bold ${draft.notes && draft.notes.length >= 190 ? 'text-rose-500' : 'text-amber-600/60'}`}>
                                    {draft.notes?.length || 0}/200
                                </span>
                            </div>
                            <input
                                type="text"
                                maxLength={200}
                                placeholder="Observación o respuesta rápida a la técnica..."
                                value={draft.notes || ""}
                                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                                className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 shadow-sm transition-all"
                            />
                        </div>

                        {/* Vinculación de Objetivos */}
                        {activeObjectives.length > 0 && (
                            <div className="col-span-1 md:col-span-12 mt-2 pt-3 border-t border-amber-200/50">
                                <label className="block text-[10px] font-bold text-amber-800 mb-2 uppercase tracking-wide">
                                    Vincular a Objetivos de la Sesión (Opcional)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {activeObjectives.map(obj => {
                                        const isLinked = draft.objectiveIds?.includes(obj.id);
                                        return (
                                            <button
                                                key={obj.id}
                                                type="button"
                                                onClick={() => {
                                                    const curr = draft.objectiveIds || [];
                                                    setDraft({
                                                        ...draft,
                                                        objectiveIds: isLinked ? curr.filter(i => i !== obj.id) : [...curr, obj.id]
                                                    });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border shadow-sm flex items-center gap-1.5 ${isLinked
                                                    ? 'bg-amber-500 text-white border-amber-600'
                                                    : 'bg-white text-slate-500 border-amber-200 hover:border-amber-400 hover:text-amber-700'
                                                    }`}
                                            >
                                                {isLinked && <CheckIcon className="w-3.5 h-3.5" />}
                                                {obj.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Botón Acción */}
                    <div className="mt-5 flex justify-end">
                        <button
                            type="button"
                            onClick={handleSaveDraft}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                        >
                            <CheckIcon className="w-4 h-4" />
                            Guardar Intervención
                        </button>
                    </div>
                </div>
            )}

            {/* LISTA EDITABLE (CHIPS O CARDS CONDENSADAS) DE LO YA GUARDADO */}
            {currentList.length > 0 && !draft && (
                <div className="flex flex-col gap-2.5">
                    {currentList.map((rec) => (
                        <div key={rec.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm hover:border-amber-300 transition-colors group">

                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest bg-amber-100 px-2 py-0.5 rounded">
                                        {rec.category}
                                    </span>
                                    <span className="text-sm font-bold text-slate-700">{rec.subType === 'Otro' ? 'Técnica Manual' : rec.subType}</span>
                                    {rec.dose && <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{rec.dose}</span>}
                                    {rec.intensity && <span className="text-[10px] font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 rounded">{rec.intensity}</span>}
                                </div>
                                {rec.notes && <p className="text-xs text-slate-500 italic mt-0.5">{rec.notes}</p>}

                                {rec.objectiveIds && rec.objectiveIds.length > 0 && activeObjectives.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {rec.objectiveIds.map(oid => {
                                            const matched = activeObjectives.find(a => a.id === oid);
                                            return matched ? (
                                                <span key={oid} className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <CheckIcon className="w-2 h-2" />
                                                    {matched.label.substring(0, 30)}{matched.label.length > 30 ? '...' : ''}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>

                            {!disabled && (
                                <div className="flex items-center self-end sm:self-center gap-2 border-l border-slate-100 pl-3">
                                    <button
                                        type="button"
                                        onClick={() => handleEditDraft(rec)}
                                        className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"
                                    >
                                        <PencilSquareIcon className="w-4 h-4" /> Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(rec.id)}
                                        className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* BOTONES CREADORES (Solo visibles si no hay borrador activo) */}
            {!disabled && !draft && (
                <div className="bg-slate-50/70 border border-dashed border-slate-300 rounded-2xl p-4 text-center mt-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Agregar Intervención Analítica</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {INTERVENTION_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => handleOpenDraft(cat)}
                                className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black hover:bg-amber-50 hover:text-amber-700 hover:border-amber-400 hover:shadow-md transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                            >
                                <PlusIcon className="w-4 h-4 opacity-70" />
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
