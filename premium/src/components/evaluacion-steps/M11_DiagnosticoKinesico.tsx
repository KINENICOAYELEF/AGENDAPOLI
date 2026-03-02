import React, { useState } from "react";
import { Evaluacion } from "@/types/clinica";

interface M11Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M11_DiagnosticoKinesico({ formData, updateFormData, isClosed }: M11Props) {
    const [isGenerating, setIsGenerating] = useState(false);

    const dx = formData.dxKinesico || {
        narrative: '',
        icfStructure: '',
        differentialFunctional: ''
    };

    const updateDx = (field: keyof typeof dx, value: string) => {
        updateFormData(prev => ({
            dxKinesico: {
                ...(prev.dxKinesico || {}),
                [field]: value
            }
        }));
    };

    const handleGenerateDx = async () => {
        setIsGenerating(true);
        try {
            const prompt = `Genera un Diagnóstico Kinésico estructurado (M11) basado en los datos clínicos:
${JSON.stringify(formData, null, 2)}

Devuelve estrictamente un JSON con las claves "narrative" (párrafo síntesis completo), "icfStructure" (bullet points estructurados), "differentialFunctional" (hipótesis clínicas secundarias si la principal erra).`;

            const res = await fetch('/api/ai/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, schemaType: 'm11_dx' })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Error en Gemini');

            const realOutput = data.data;

            updateFormData(prev => ({
                dxKinesico: {
                    ...(prev.dxKinesico || {}),
                    narrative: realOutput.narrative,
                    icfStructure: realOutput.icfStructure,
                    differentialFunctional: realOutput.differentialFunctional
                },
                ai: {
                    ...(prev.ai || {}),
                    lastRunAt: new Date().toISOString()
                }
            }));

        } catch (error) {
            console.error(error);
            alert("Error al generar el diagnóstico con IA.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-2xl">📝</span>
                <div>
                    <h3 className="text-lg font-black text-slate-800">M11: Diagnóstico Kinésico y BPS</h3>
                    <p className="text-xs text-slate-500 font-medium">Síntesis clínica narrativa, estructuración tipo CIF, y diagnóstico diferencial funcional.</p>
                </div>
            </div>

            <div className="bg-white border text-left border-slate-200 p-5 lg:p-6 rounded-2xl shadow-sm space-y-6">

                {/* AI Trigger */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h4 className="text-sm font-bold text-indigo-900 mb-1 flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            Síntesis Asistida por IA
                        </h4>
                        <p className="text-[10px] text-indigo-700/70">Redacta el diagnóstico amalgamando Anamnesis, Examen Físico y Factores Biopsicosociales automáticamente.</p>
                    </div>
                    {!isClosed && (
                        <button
                            onClick={handleGenerateDx}
                            disabled={isGenerating}
                            className={`shrink-0 px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${isGenerating ? 'bg-indigo-200 text-indigo-500 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'}`}
                        >
                            {isGenerating ? 'Generando...' : '✨ Borrador Mágico'}
                        </button>
                    )}
                </div>

                {/* Form Fields */}
                <div className="space-y-5">

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex justify-between">
                            <span>Narrativa de Diagnóstico Kinésico Global <span className="text-rose-500">*</span></span>
                            <span className="text-[10px] text-slate-400 font-normal">Requerido para cierre</span>
                        </label>
                        <textarea
                            rows={3}
                            disabled={isClosed}
                            placeholder="Redacta la síntesis del cuadro del paciente..."
                            value={dx.narrative || ''}
                            onChange={e => updateDx('narrative', e.target.value)}
                            className="w-full border border-slate-300 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none resize-y shadow-inner font-medium text-slate-800"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <span className="text-emerald-500">🧱</span> Estructuración ICF-Like
                            </label>
                            <textarea
                                rows={4}
                                disabled={isClosed}
                                placeholder="Estructuras, Función, Actividad, Participación, Contexto..."
                                value={dx.icfStructure || ''}
                                onChange={e => updateDx('icfStructure', e.target.value)}
                                className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-xs focus:border-indigo-400 outline-none resize-y"
                            />
                            <p className="text-[9px] text-slate-400 mt-1">Acota el problema a la clasificación internacional de funcionamiento.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <span className="text-amber-500">⚖️</span> Diagnóstico Diferencial Funcional
                            </label>
                            <textarea
                                rows={4}
                                disabled={isClosed}
                                placeholder="Sospechas patokinesiologicas alternativas..."
                                value={dx.differentialFunctional || ''}
                                onChange={e => updateDx('differentialFunctional', e.target.value)}
                                className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-xs focus:border-indigo-400 outline-none resize-y"
                            />
                            <p className="text-[9px] text-slate-400 mt-1">Alternativas si la hipótesis principal falla (Driver Funcional vs Estructural).</p>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
