import React from "react";
import { Evaluacion } from "@/types/clinica";

interface M9Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M9_ClasificacionInteligente({ formData, updateFormData, isClosed }: M9Props) {

    const updateMotivo = (motivoId: string, fieldPath: string, value: any) => {
        updateFormData(prev => {
            const nuevos = [...(prev.motivos || [])];
            const idx = nuevos.findIndex(m => m.id === motivoId);
            if (idx === -1) return prev;

            const motivo = { ...nuevos[idx] };

            motivo.classification = {
                ...(motivo.classification || { tags: [] }),
                [fieldPath]: value
            };

            nuevos[idx] = motivo;
            return { ...prev, motivos: nuevos };
        });
    };

    const toggleTag = (motivoId: string, currentTags: string[], tag: string) => {
        const hasTag = currentTags.includes(tag);
        const newTags = hasTag ? currentTags.filter(t => t !== tag) : [...currentTags, tag];
        updateMotivo(motivoId, 'tags', newTags);
    };

    const commonTags = [
        "Deficiencia de Movilidad",
        "Déficit Control Motor",
        "Sensibilización Central",
        "Dolor Referido",
        "Radiculopatía",
        "Sobrecarga de Tejido",
        "Post-Quirúrgico",
        "Agudo (< 6sem)",
        "Crónico (> 12sem)"
    ];

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-2xl">🧠</span>
                <div>
                    <h3 className="text-lg font-black text-slate-800">M9: Clasificación Clínica</h3>
                    <p className="text-xs text-slate-500 font-medium">Categorización diagnóstica final pre-IA.</p>
                </div>
            </div>

            {formData.motivos?.map((motivo, mIndex) => {
                const clazz = motivo.classification || { tags: [] };

                // Get irritability from M2 if available to pre-fill or guide
                const m2Irritability = motivo.subjective?.irritability;

                return (
                    <div key={motivo.id} className="bg-white border text-left border-slate-200 p-5 lg:p-6 rounded-2xl shadow-sm space-y-6 mb-6">

                        <div className="border-b border-indigo-100 pb-3 mb-4 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-1 rounded-lg">Foco {mIndex + 1}</span>
                            <h4 className="font-bold text-slate-700">{motivo.motivoLabel || 'Sin Nombre'}</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Irritabilidad Final */}
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                <label className="block text-xs font-bold text-slate-700 mb-2">Irritabilidad Final de la Clase</label>
                                {m2Irritability && !clazz.irritabilityFinal && (
                                    <p className="text-[10px] text-indigo-500 mb-2 font-medium">Sugerencia M2 Anamnesis: {m2Irritability}</p>
                                )}
                                <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                    {['Alta', 'Media', 'Baja'].map(val => (
                                        <button
                                            key={val}
                                            disabled={isClosed}
                                            onClick={() => updateMotivo(motivo.id, 'irritabilityFinal', val)}
                                            className={`flex-1 py-2 text-xs font-bold transition-colors ${clazz.irritabilityFinal === val
                                                ? (val === 'Alta' ? 'bg-rose-100 text-rose-800' : val === 'Media' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')
                                                : 'text-slate-500 hover:bg-slate-50 border-r last:border-r-0 border-slate-100'}`}
                                        >
                                            {val}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mecanismo Definitivo */}
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                <label className="block text-xs font-bold text-slate-700 mb-2">Mecanismo del Dolor Dominante</label>
                                <select
                                    disabled={isClosed}
                                    value={clazz.mecanismoDolorDefinitivo || ''}
                                    onChange={e => updateMotivo(motivo.id, 'mecanismoDolorDefinitivo', e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none shadow-sm font-medium text-slate-700 bg-white"
                                >
                                    <option value="" disabled>Seleccione el mecanismo doloroso...</option>
                                    <option value="Nociceptivo">Nociceptivo (Daño tisular claro)</option>
                                    <option value="Neuropático">Neuropático (Lesión nervio periférico)</option>
                                    <option value="Nociplástico">Nociplástico (Sensibilización central/Alterado)</option>
                                    <option value="Mixto">Mixto</option>
                                </select>
                            </div>

                            {/* Etiquetas / Tags Clínicos */}
                            <div className="md:col-span-2 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                <label className="block text-xs font-bold text-slate-700 mb-2">Etiquetas Clínicas / Impairment Classification</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {commonTags.map(tag => (
                                        <button
                                            key={tag}
                                            disabled={isClosed}
                                            onClick={() => toggleTag(motivo.id, clazz.tags || [], tag)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${(clazz.tags || []).includes(tag)
                                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-md'
                                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100 shadow-sm'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        disabled={isClosed}
                                        placeholder="Tag personalizado e [Enter]..."
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                e.preventDefault();
                                                toggleTag(motivo.id, clazz.tags || [], e.currentTarget.value.trim());
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white shadow-sm"
                                    />
                                    <p className="text-[10px] text-slate-400 font-medium">Presiona Enter para agregar.</p>
                                </div>
                            </div>

                        </div>
                    </div>
                );
            })}
        </div>
    );
}
