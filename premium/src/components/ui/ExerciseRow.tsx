import React, { useState, useEffect, useRef } from 'react';
import { ExercisePrescription } from '@/types/clinica';
import {
    ChevronUpIcon,
    ChevronDownIcon,
    TrashIcon,
    ChevronDownIcon as ExpandIcon,
    ChevronRightIcon as CollapseIcon
} from '@heroicons/react/20/solid';
import { NumericStepper } from './NumericStepper';

interface ExerciseRowProps {
    exercise: ExercisePrescription;
    index: number;
    effortMode: 'RIR' | 'RPE';
    isClosed: boolean;
    onChange: (updated: ExercisePrescription) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onDuplicateFromAbove?: () => void;
    isFirst: boolean;
    isLast: boolean;
}

export const ExerciseRow: React.FC<ExerciseRowProps> = ({
    exercise,
    index,
    effortMode,
    isClosed,
    onChange,
    onRemove,
    onMoveUp,
    onMoveDown,
    onDuplicateFromAbove,
    isFirst,
    isLast
}) => {
    const [localEx, setLocalEx] = useState<ExercisePrescription>(exercise);
    const [isExpanded, setIsExpanded] = useState(false);

    const isFirstRender = useRef(true);
    const prevExStr = useRef(JSON.stringify(exercise));

    // Sync from parent only if parent explicitly changed the data (e.g. initial load or duplicate)
    useEffect(() => {
        const currentStr = JSON.stringify(exercise);
        const localStr = JSON.stringify(localEx);
        if (currentStr !== prevExStr.current && currentStr !== localStr) {
            setLocalEx(exercise);
        }
        prevExStr.current = currentStr;
    }, [exercise]);

    // Debounced sync to parent
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        const timer = setTimeout(() => {
            onChange(localEx);
        }, 700);
        return () => clearTimeout(timer);
    }, [localEx, onChange]);

    const updateField = (field: keyof ExercisePrescription, value: any) => {
        setLocalEx(prev => ({ ...prev, [field]: value }));
    };

    const toggleEquipment = (eq: string) => {
        const current = localEx.equipment || [];
        const isSelected = current.includes(eq);
        const newVal = isSelected ? current.filter(e => e !== eq) : [...current, eq];
        updateField("equipment", newVal.length ? newVal : undefined);
    };

    return (
        <div className="bg-slate-900/50 border border-indigo-700/50 rounded-2xl p-4 mb-3 relative group transition-all hover:border-indigo-500/80 shadow-md">
            {/* HEADER DEL EJERCICIO */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-white bg-indigo-600 px-2.5 py-1.5 rounded uppercase tracking-widest shadow-md border border-indigo-500">
                        Ej. {index + 1}
                    </span>
                    {!isClosed && (
                        <div className="flex bg-slate-950/50 rounded-lg border border-indigo-900/50 overflow-hidden shadow-inner ml-2">
                            <button type="button" onClick={onMoveUp} disabled={isFirst} className="p-1.5 text-indigo-400 hover:text-white hover:bg-indigo-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                                <ChevronUpIcon className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={onMoveDown} disabled={isLast} className="p-1.5 text-indigo-400 hover:text-white hover:bg-indigo-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors border-l border-indigo-900/50">
                                <ChevronDownIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    {!isClosed && index > 0 && onDuplicateFromAbove && (
                        <button
                            type="button"
                            onClick={onDuplicateFromAbove}
                            title="Copiar datos del ejercicio anterior"
                            className="text-[10px] font-bold text-indigo-400 bg-indigo-950/40 hover:bg-indigo-800 px-2 py-1.5 rounded-lg border border-indigo-800 transition-all"
                        >
                            Copiar de Arriba
                        </button>
                    )}
                    {!isClosed && (
                        <button type="button" onClick={onRemove} className="text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-700 p-1.5 rounded-lg transition-all border border-rose-900 shadow-sm">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* VISTA COMPACTA DIRECTA (MÓVIL-FIRST) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-y-4 gap-x-3 mt-1">
                {/* Nombre de Fila de ancho completo en móvil o 5 cols en PC */}
                <div className="col-span-1 md:col-span-12">
                    <input
                        type="text"
                        placeholder="Nombre Ejercicio (Ej: Sentadilla Búlgara)"
                        disabled={isClosed}
                        value={localEx.name}
                        onChange={e => updateField("name", e.target.value)}
                        className="w-full bg-slate-950/70 border border-indigo-800/80 rounded-xl px-4 py-2 text-sm font-black text-white outline-none focus:border-indigo-400 focus:bg-slate-900 transition-all placeholder:text-indigo-400/50 h-11"
                    />
                </div>

                {/* ROW DE DOSIS COMPACTA */}
                <div className="col-span-1 md:col-span-12 grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <NumericStepper label="Series" placeholder="Sets" disabled={isClosed} value={localEx.sets} onChange={val => updateField("sets", val)} />
                    <NumericStepper label="Reps/Tiempo" placeholder="Reps" disabled={isClosed} value={localEx.repsOrTime} onChange={val => updateField("repsOrTime", val)} />
                    <NumericStepper label="Carga" placeholder="Kg" step={2.5} disabled={isClosed} value={localEx.loadKg || ""} onChange={val => updateField("loadKg", val)} />

                    {effortMode === 'RIR' ? (
                        <NumericStepper label="RIR (Reserva)" placeholder="0-10" step={1} min={0} max={10} disabled={isClosed} value={localEx.rir || localEx.rpeOrRir || ""} onChange={val => updateField("rir", val)} />
                    ) : (
                        <NumericStepper label="RPE (Esfuerzo)" placeholder="1-10" step={1} min={1} max={10} disabled={isClosed} value={localEx.rpe || localEx.rpeOrRir || ""} onChange={val => updateField("rpe", val)} />
                    )}

                    <NumericStepper label="Descanso" placeholder="Seg/Min" disabled={isClosed} value={localEx.rest || ""} onChange={val => updateField("rest", val)} />
                </div>
            </div>

            {/* BOTÓN TOGGLE AVANZADO */}
            <div className="mt-4 pt-3 border-t border-indigo-900/30 flex justify-center">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-200 uppercase tracking-widest transition-colors bg-indigo-950/30 px-3 py-1.5 rounded-full"
                >
                    {isExpanded ? (
                        <><ExpandIcon className="w-4 h-4" /> Ocultar Detalles Avanzados</>
                    ) : (
                        <><CollapseIcon className="w-4 h-4" /> Expandir Detalles Avanzados</>
                    )}
                </button>
            </div>

            {/* VISTA AVANZADA COLAPSABLE */}
            {isExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-y-4 gap-x-3 mt-4 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="col-span-1 md:col-span-8">
                        <label className="block text-[9px] font-bold text-indigo-400/70 mb-2 ml-1 uppercase">Implementos Adicionales</label>
                        <div className="flex flex-wrap gap-1.5 items-center">
                            {['Banda', 'Mancuerna', 'Kettlebell', 'Polea', 'TRX', 'Fitball', 'Barra', 'Máquina', 'P. Corporal', 'Otro'].map(eq => {
                                const isSelected = localEx.equipment?.includes(eq);
                                return (
                                    <button
                                        key={eq}
                                        type="button"
                                        disabled={isClosed}
                                        onClick={() => toggleEquipment(eq)}
                                        className={`px-2 py-1.5 text-[10px] rounded-lg font-bold transition-all border ${isSelected ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'bg-slate-950/40 text-indigo-300 hover:text-white border-indigo-800/50 hover:bg-slate-800'}`}
                                    >
                                        {eq}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-4">
                        <label className="block text-[9px] font-bold text-indigo-400/70 mb-1 ml-1 uppercase">Patrón / Lado</label>
                        <div className="flex gap-1 h-10">
                            <select disabled={isClosed} value={localEx.pattern || ""} onChange={e => updateField("pattern", e.target.value || undefined)} className="w-[60%] bg-slate-950/70 border border-indigo-800/80 rounded-l-xl px-2 text-[11px] font-bold text-indigo-100 outline-none focus:border-indigo-400 transition-all">
                                <option value="">Patrón...</option>
                                <option value="Sentadilla">Sentadilla</option>
                                <option value="Bisagra">Bisagra</option>
                                <option value="Empuje">Empuje</option>
                                <option value="Tracción">Tracción</option>
                                <option value="Core">Core</option>
                                <option value="Movilidad">Movilidad</option>
                                <option value="Otro">Otro</option>
                            </select>
                            <select disabled={isClosed} value={localEx.side || ""} onChange={e => updateField("side", e.target.value || undefined)} className="w-[40%] bg-slate-950/70 border border-indigo-800/80 border-l-0 rounded-r-xl px-1 text-[11px] font-bold text-indigo-100 outline-none focus:border-indigo-400 transition-all">
                                <option value="">Lado...</option>
                                <option value="Bilateral">Bi</option>
                                <option value="Unilateral Izq">Izq</option>
                                <option value="Unilateral Der">Der</option>
                            </select>
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-4 mt-2">
                        <label className="block text-[9px] font-bold text-indigo-400/70 mb-1 ml-1 uppercase">Clave de Progresión</label>
                        <select disabled={isClosed} value={localEx.mainVariable || ""} onChange={e => updateField("mainVariable", e.target.value || undefined)} className="w-full bg-slate-950/70 border border-indigo-800/80 rounded-xl px-3 h-10 text-xs font-bold text-indigo-100 outline-none focus:border-indigo-400 transition-all">
                            <option value="">Variable dominante...</option>
                            <option value="Carga">Carga</option>
                            <option value="Volumen">Volumen</option>
                            <option value="Densidad">Densidad</option>
                            <option value="ROM">ROM</option>
                            <option value="Velocidad">Velocidad</option>
                            <option value="Técnica">Técnica</option>
                        </select>
                    </div>

                    <div className="col-span-1 md:col-span-4 mt-2">
                        <label className="block text-[9px] font-bold text-indigo-400/70 mb-1 ml-1 uppercase">Criterio de Progresión</label>
                        <select disabled={isClosed} value={localEx.progressionCriteria || ""} onChange={e => updateField("progressionCriteria", e.target.value || undefined)} className="w-full bg-slate-950/70 border border-indigo-800/80 rounded-xl px-3 h-10 text-xs font-bold text-indigo-100 outline-none focus:border-indigo-400 transition-all">
                            <option value="">Define el criterio...</option>
                            <option value="Subir Carga">Subir Carga</option>
                            <option value="Subir Reps">Subir Reps</option>
                            <option value="Bajar RIR">Bajar RIR</option>
                            <option value="Subir RPE">Subir RPE</option>
                            <option value="+ Velocidad">+ Velocidad intencional</option>
                            <option value="+ ROM">+ ROM tolerado</option>
                            <option value="Sostenido">Mantener estímulo</option>
                        </select>
                    </div>

                    <div className="col-span-1 md:col-span-12 lg:col-span-12 mt-2">
                        <label className="block text-[9px] font-bold text-indigo-400/70 mb-1 ml-1 uppercase">Ajustes Biomecánicos / Notas</label>
                        <input type="text" placeholder="Ej: Foco en rotación externa, elástico amarillo..." disabled={isClosed} value={localEx.notes || ""} onChange={e => updateField("notes", e.target.value)} className="w-full bg-slate-950/70 border border-indigo-800/80 rounded-xl px-4 h-10 text-xs text-indigo-50 outline-none focus:border-indigo-400 focus:bg-slate-900 transition-all placeholder:text-indigo-400/30" />
                    </div>
                </div>
            )}
        </div>
    );
};
