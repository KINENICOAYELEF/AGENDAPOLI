import React from "react";
import { Evaluacion } from "@/types/clinica";

interface M4Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M4_FactoresBPS({ formData, updateFormData, isClosed }: M4Props) {
    const bps = formData.bpsFactors || {
        flagsChecklist: {},
        positiveFactors: [],
        negativeFactors: [],
        bpsImpactSuggested: 'Bajo'
    };

    const updateBPSField = (field: keyof typeof bps, value: any) => {
        updateFormData(prev => ({
            bpsFactors: {
                ...(prev.bpsFactors || { flagsChecklist: {}, positiveFactors: [], negativeFactors: [], bpsImpactSuggested: 'Bajo' }),
                [field]: value
            }
        }));
    };

    const handleCheckToggle = (flag: string, checked: boolean) => {
        const currentChecks = bps.flagsChecklist || {};
        updateBPSField('flagsChecklist', { ...currentChecks, [flag]: checked });
    };

    const handleArrayInput = (field: 'positiveFactors' | 'negativeFactors', value: string) => {
        const arr = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
        updateBPSField(field, arr);
    };

    const bpsFlagsList = [
        "Kinesiofobia manifiesta (Miedo al movimiento)",
        "Catastrofización alta",
        "Aislamiento social / Poca red de apoyo",
        "Creencias sobre daño estructural vs dolor",
        "Poco control o auto-eficacia percibida",
        "Depresión / Ansiedad severa documentada"
    ];

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-2xl">🧠</span>
                <div>
                    <h3 className="text-lg font-black text-slate-800">M4: Factores Biopsicosociales (BPS)</h3>
                    <p className="text-xs text-slate-500 font-medium">Batería rápida de barreras y facilitadores pronósticos.</p>
                </div>
            </div>

            <div className="bg-white border text-left border-slate-200 p-5 lg:p-6 rounded-2xl shadow-sm space-y-6">

                {/* Flags BPS (Checklist rápido) */}
                <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="text-amber-500">🚩</span> Potenciales Barreras (Yellow Flags Clínicas)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                        {bpsFlagsList.map(flag => (
                            <label key={flag} className={`flex items-start gap-2.5 p-2 rounded-lg transition-colors cursor-pointer ${bps.flagsChecklist?.[flag] ? 'bg-amber-100/50' : 'hover:bg-slate-100'}`}>
                                <input
                                    type="checkbox"
                                    checked={!!bps.flagsChecklist?.[flag]}
                                    onChange={e => handleCheckToggle(flag, e.target.checked)}
                                    disabled={isClosed}
                                    className="mt-1 w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                                />
                                <span className={`text-sm ${bps.flagsChecklist?.[flag] ? 'text-amber-900 font-semibold' : 'text-slate-600'}`}>
                                    {flag}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Factores Libres Positivos y Negativos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-emerald-700 mb-1.5 flex items-center gap-1.5">
                            <span className="text-base text-emerald-500">✨</span> Facilitadores (Factores Protectores)
                        </label>
                        <textarea
                            rows={3}
                            value={bps.positiveFactors?.join(', ') || ''}
                            onChange={e => handleArrayInput('positiveFactors', e.target.value)}
                            disabled={isClosed}
                            placeholder="Ej. Alta motivación, red de apoyo familiar, adhiere bien. (Separar por comas)"
                            className="w-full border border-emerald-200 bg-emerald-50/30 rounded-xl px-4 py-3 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none resize-none placeholder:text-emerald-300 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-rose-700 mb-1.5 flex items-center gap-1.5">
                            <span className="text-base text-rose-500">⚠️</span> Otras Barreras Estresoras
                        </label>
                        <textarea
                            rows={3}
                            value={bps.negativeFactors?.join(', ') || ''}
                            onChange={e => handleArrayInput('negativeFactors', e.target.value)}
                            disabled={isClosed}
                            placeholder="Ej. Dificultad económica, conflicto legal pendiente. (Separar por comas)"
                            className="w-full border border-rose-200 bg-rose-50/30 rounded-xl px-4 py-3 text-sm focus:border-rose-400 focus:ring-1 focus:ring-rose-100 outline-none resize-none placeholder:text-rose-300 transition-colors"
                        />
                    </div>
                </div>

                {/* Síntesis Sugerida */}
                <div className="pt-4 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Impacto BPS Sugerido (Pronóstico)</label>
                    <div className="flex flex-wrap gap-2">
                        {['Bajo', 'Moderado', 'Alto'].map(nivel => (
                            <button
                                key={nivel}
                                onClick={() => updateBPSField('bpsImpactSuggested', nivel)}
                                disabled={isClosed}
                                className={`px-4 py-2 text-sm font-bold rounded-xl transition-all border ${bps.bpsImpactSuggested === nivel
                                    ? nivel === 'Alto' ? 'bg-rose-100 text-rose-800 border-rose-300 ring-2 ring-rose-50'
                                        : nivel === 'Moderado' ? 'bg-amber-100 text-amber-800 border-amber-300 ring-2 ring-amber-50'
                                            : 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-50'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                {nivel === 'Alto' ? '🔴' : nivel === 'Moderado' ? '🟡' : '🟢'} Impacto {nivel}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Ayudará a la IA a sugerir un plan educativo o de derivación psicológica.</p>
                </div>

            </div>
        </div>
    );
}
