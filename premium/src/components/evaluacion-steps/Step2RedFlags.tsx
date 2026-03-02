import React from "react";
import { Evaluacion } from "@/types/clinica";

export function Step2RedFlags({
    formData,
    updateFormData,
    isClosed
}: {
    formData: Partial<Evaluacion>,
    updateFormData: (patch: any) => void,
    isClosed: boolean
}) {

    const updateMotivo = (id: string, fieldPath: string, value: any) => {
        updateFormData((prev: Partial<Evaluacion>) => {
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
            return { ...prev, motivos: nuevos };
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
        return <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300">Debes ingresar primero un motivo de consulta.</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-4">
                <h3 className="text-lg font-black text-rose-800 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    2. Screening Bioético de Red Flags
                </h3>
                <p className="text-xs text-rose-600/70 font-medium">Marcador crítico. Su presencia exige derivación u observación clínica justificada.</p>
            </div>

            {formData.motivos.map((motivo) => {
                const hasFlags = Object.values(motivo.redFlagsChecklist || {}).some(v => v === true);
                const isInvalid = hasFlags && !motivo.redFlagsActionText?.trim();

                return (
                    <div key={motivo.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden mb-6 border transition-colors ${isInvalid ? 'border-rose-400 ring-4 ring-rose-50' : 'border-slate-200'}`}>
                        <div className="bg-slate-50 border-b border-slate-100 p-3 px-4">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">{motivo.motivoLabel} ({motivo.region})</h4>
                        </div>

                        <div className="p-4 md:p-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
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

                            {hasFlags && (
                                <div className={`p-4 rounded-xl border mt-5 transition-all animate-in fade-in slide-in-from-top-2 ${isInvalid ? 'bg-rose-50 border-rose-300 shadow-sm' : 'bg-white border-slate-200'}`}>
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
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
