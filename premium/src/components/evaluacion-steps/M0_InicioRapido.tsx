import React from 'react';
import { Evaluacion } from '@/types/clinica';

interface M0Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M0_InicioRapido({ formData, updateFormData, isClosed }: M0Props) {
    const handleMainMotiveChange = (value: string) => {
        updateFormData(prev => {
            const currentMotivos = prev.motivos ? [...prev.motivos] : [];
            if (currentMotivos.length === 0) {
                // Should not happen due to pre-fill, but just in case
                currentMotivos.push({
                    id: Date.now().toString(),
                    motivoLabel: value,
                    region: '',
                    lado: 'N/A',
                    subjective: {},
                    redFlagsChecklist: {}
                } as any);
            } else {
                currentMotivos[0].motivoLabel = value;
            }
            return { motivos: currentMotivos };
        });
    };

    const mainMotive = formData.motivos?.[0]?.motivoLabel || '';

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">⚡</span>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 leading-tight">M0: Inicio Rápido</h3>
                        <p className="text-sm text-slate-500">Motivo principal, dolor actual y despistaje rápido.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Motivo Principal */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 flex justify-between items-center">
                            Motivo Principal de Consulta
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Requerido</span>
                        </label>
                        <textarea
                            value={mainMotive}
                            onChange={(e) => handleMainMotiveChange(e.target.value)}
                            disabled={isClosed}
                            placeholder="Ej: Dolor en rodilla derecha al subir escaleras..."
                            className="w-full rounded-xl border-slate-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-colors disabled:bg-slate-50 disabled:text-slate-500 resize-none"
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* EVA Global */}
                        <div className="space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <label className="text-sm font-bold text-slate-700 block mb-3">
                                Dolor Actual (EVA 0-10)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    value={formData.evaActualGlobal || 0}
                                    onChange={(e) => updateFormData({ evaActualGlobal: e.target.value })}
                                    disabled={isClosed}
                                    className="w-full accent-indigo-600 cursor-pointer disabled:opacity-50"
                                />
                                <div className="w-12 h-12 shrink-0 bg-white border-2 border-indigo-100 rounded-xl flex items-center justify-center font-black text-indigo-700 shadow-sm text-lg">
                                    {formData.evaActualGlobal || '-'}
                                </div>
                            </div>
                            <div className="flex justify-between text-xs font-medium text-slate-400 px-1 mt-1">
                                <span>No duele</span>
                                <span>Peor dolor</span>
                            </div>
                        </div>

                        {/* Filtro Urgencia */}
                        <div className="space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center">
                            <label className="text-sm font-bold text-slate-700">
                                ¿Requiere derivación médica urgente?
                            </label>
                            <p className="text-xs text-slate-500 mb-3">Filtro rápido previo al triaje (Red Flags).</p>

                            <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.urgencyFilter
                                    ? 'bg-rose-50 border-rose-500 shadow-sm'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                } ${isClosed ? 'opacity-70 pointer-events-none' : ''}`}>
                                <div className="flex items-center h-5 mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={formData.urgencyFilter || false}
                                        onChange={(e) => updateFormData({ urgencyFilter: e.target.checked })}
                                        disabled={isClosed}
                                        className="w-5 h-5 rounded text-rose-600 border-slate-300 focus:ring-rose-600 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <span className={`text-sm font-bold block leading-tight ${formData.urgencyFilter ? 'text-rose-800' : 'text-slate-700'}`}>
                                        Sí, derivación a urgencias sugerida
                                    </span>
                                    <span className={`text-xs block mt-0.5 ${formData.urgencyFilter ? 'text-rose-600' : 'text-slate-500'}`}>
                                        Marcar si el paciente presenta un cuadro que requiere atención médica antes de continuar.
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
