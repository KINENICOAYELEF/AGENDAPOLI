import React from "react";
import { Evaluacion } from "@/types/clinica";

interface M1Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M1_TriageRedFlags({ formData, updateFormData, isClosed }: M1Props) {

    const updateMotivo = (id: string, fieldPath: string, value: any) => {
        updateFormData(prev => {
            const nuevos = [...(prev.motivos || [])];
            const idx = nuevos.findIndex(m => m.id === id);
            if (idx === -1) return prev;

            const motivo = { ...nuevos[idx] };
            const keys = fieldPath.split('.');

            if (keys.length === 1) {
                (motivo as any)[keys[0]] = value;
            } else if (keys.length === 2) {
                (motivo as any)[keys[0]] = { ...(motivo as any)[keys[0]], [keys[1]]: value };
            }

            nuevos[idx] = motivo;
            return { motivos: nuevos };
        });
    };

    const redFlagItems = [
        'Pérdida de peso inexplicable',
        'Fiebre persistente/Sudores nocturnos',
        'Dolor nocturno que no cede con cambio de pos.',
        'Alteraciones sensitivas en silla de montar',
        'Cambios agudos en continencia esfinteriana',
        'Déficits neurológicos progresivos',
        'Trauma agudo de alta energía',
        'Síntomas constitucionales atípicos'
    ];

    if (!formData.motivos || formData.motivos.length === 0) {
        return <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300">Debes ingresar primero un motivo de consulta activo en el Módulo 0.</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">🚩</span>
                    <div>
                        <h3 className="text-lg font-black text-rose-800 leading-tight">M1: Triage y Red Flags</h3>
                        <p className="text-sm text-rose-600/80 font-medium">Marcador crítico. Su presencia exige derivación u observación clínica justificada.</p>
                    </div>
                </div>

                {formData.motivos.map((motivo) => {
                    const hasFlags = Object.values(motivo.redFlagsChecklist || {}).some(v => v === true);
                    const isInvalid = hasFlags && !motivo.redFlagsActionText?.trim();

                    return (
                        <div key={motivo.id} className={`bg-white rounded-xl overflow-hidden mb-6 border transition-colors ${isInvalid ? 'border-rose-400 ring-4 ring-rose-50' : 'border-slate-200'}`}>
                            <div className="bg-slate-50 border-b border-slate-100 p-3 px-4 flex justify-between items-center">
                                <h4 className="text-sm font-bold text-slate-700 tracking-tight">{motivo.motivoLabel || 'Motivo sin título'}</h4>
                            </div>

                            <div className="p-4 md:p-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                                    {redFlagItems.map(flag => (
                                        <label key={flag} className={`flex flex-row flex-none items-start gap-2 text-[11px] md:text-xs font-semibold px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${motivo.redFlagsChecklist?.[flag] ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                            <input
                                                type="checkbox"
                                                checked={!!motivo.redFlagsChecklist?.[flag]}
                                                disabled={isClosed}
                                                onChange={e => updateMotivo(motivo.id, 'redFlagsChecklist', { ...motivo.redFlagsChecklist, [flag]: e.target.checked })}
                                                className="mt-0.5 w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 focus:ring-2 focus:ring-offset-1"
                                            />
                                            <span className="flex-1 leading-snug">{flag}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className="flex flex-col md:flex-row gap-4">
                                    {/* Action Text */}
                                    {hasFlags && (
                                        <div className={`flex-1 p-4 rounded-xl border transition-all animate-in fade-in slide-in-from-top-2 ${isInvalid ? 'bg-rose-50 border-rose-300 shadow-sm' : 'bg-white border-slate-200'}`}>
                                            <label className="block text-xs font-bold text-rose-800 mb-1.5 flex items-center gap-1.5">
                                                Acción / Conducta Bioética Inmediata
                                                {isInvalid && <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full ml-2">REQUERIDO</span>}
                                            </label>
                                            <textarea
                                                rows={3}
                                                placeholder="Ej. Derivado a médico traumatólogo URGENCIA. Paciente notificado."
                                                value={motivo.redFlagsActionText || ''}
                                                onChange={e => updateMotivo(motivo.id, 'redFlagsActionText', e.target.value)}
                                                disabled={isClosed}
                                                className={`w-full border rounded-xl px-3.5 py-3 text-sm focus:outline-none resize-none transition-colors ${isInvalid ? 'border-rose-400 focus:border-rose-600 focus:ring-1 focus:ring-rose-200 bg-white' : 'border-slate-300 focus:border-indigo-400 bg-slate-50'}`}
                                            />
                                            <p className="text-[10px] text-rose-600 mt-2 font-medium">No podrás fijar la evaluación sin documentar la conducta a seguir si activaste una alarma.</p>
                                        </div>
                                    )}

                                    {/* Sugerencia Triaje */}
                                    <div className="w-full md:w-64 bg-slate-50 p-4 rounded-xl border border-slate-200 shrink-0 flex flex-col justify-center">
                                        <label className="text-xs font-bold text-slate-700 block mb-2">Clasificación de Triage sugerido</label>
                                        <select
                                            value={motivo.safetyStatusSuggested || (hasFlags ? 'Derivación' : 'Seguro')}
                                            onChange={(e) => updateMotivo(motivo.id, 'safetyStatusSuggested', e.target.value as any)}
                                            disabled={isClosed}
                                            className="w-full text-sm rounded-lg border-slate-300 font-medium"
                                        >
                                            <option value="Seguro">✅ Seguro (Safe to treat)</option>
                                            <option value="Precaución">⚠️ Precaución (Precautions)</option>
                                            <option value="Derivación">🚑 Derivar (Red Flags)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
