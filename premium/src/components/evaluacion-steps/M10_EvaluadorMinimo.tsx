import React, { useState } from "react";
import { Evaluacion } from "@/types/clinica";

interface M10Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M10_EvaluadorMinimo({ formData, updateFormData, isClosed }: M10Props) {
    const [isGenerating, setIsGenerating] = useState(false);

    // Estado del output de IA guardado en la evaluación
    const m10Output = formData.ai?.outputs?.m10_evalMinimo as {
        sugerenciasUniversal: string[];
        sugerenciasCondicional: string[];
        razonamiento: string;
    } | undefined;

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const prompt = `Genera sugerencias de evaluación física (M10) basándote en esta anamnesis:
${JSON.stringify(formData, null, 2)}

Devuelve estrictamente un JSON con "razonamiento" (string corto), "sugerenciasUniversal" (array de strings con ROM, Fuerza y Palpación sugeridos), y "sugerenciasCondicional" (array de strings con precauciones o tests a evitar/postergar).`;

            const res = await fetch('/api/ai/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, schemaType: 'm10_eval' })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Error en Gemini');

            const realOutput = data.data;

            updateFormData(prev => ({
                ai: {
                    ...(prev.ai || {}),
                    outputs: {
                        ...(prev.ai?.outputs || {}),
                        m10_evalMinimo: realOutput
                    },
                    lastRunAt: new Date().toISOString()
                }
            }));

        } catch (error) {
            console.error(error);
            alert("Error al generar la sugerencia.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-2xl">🤖</span>
                <div>
                    <h3 className="text-lg font-black text-slate-800">M10: Evaluador Mínimo Viable (IA)</h3>
                    <p className="text-xs text-slate-500 font-medium">Gemini analiza la Anamnesis (M0-M4) y sugiere estrictamente qué testear en Examen Físico para evitar sobrevaloración.</p>
                </div>
            </div>

            <div className="bg-white border text-left border-slate-200 p-6 lg:p-8 rounded-2xl shadow-sm">

                {/* Header IA Action */}
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-indigo-100 pb-5 mb-6 gap-4">
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">Generación de Sugerencias de Examen Físico</h4>
                        <p className="text-[10px] text-slate-500 max-w-sm mt-1">Este recomendador es consultivo. El criterio clínico prevalece. Asegúrate de tener datos en M2 Anamnesis para un mejor resultado.</p>
                    </div>
                    {!isClosed && (
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm ${isGenerating ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-indigo-800 text-white hover:shadow-md hover:from-indigo-700 hover:to-indigo-900'
                                }`}
                        >
                            {isGenerating ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Pensando...
                                </>
                            ) : (
                                <>✨ Consultar a Gemini</>
                            )}
                        </button>
                    )}
                </div>

                {/* Output Display */}
                {!m10Output && !isGenerating ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <span className="text-4xl mb-3 block opacity-30">🤔</span>
                        <p className="text-sm font-bold text-slate-400">Sin sugerencias generadas aún.</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1">Si ya definiste la anamnesis (M2), solicita una sugerencia.</p>
                    </div>
                ) : m10Output ? (
                    <div className="space-y-6 animate-in slide-in-from-bottom-2">

                        <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                            <h5 className="text-[10px] uppercase tracking-wider font-bold text-indigo-800 mb-2">Razonamiento Clínico IA</h5>
                            <p className="text-xs text-indigo-900/80 font-medium leading-relaxed">{m10Output.razonamiento}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <div>
                                <h5 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3 flex items-center gap-1.5"><span className="text-indigo-500">🎯</span> Sugerencias M7 Universal</h5>
                                <ul className="space-y-2">
                                    {(m10Output.sugerenciasUniversal || []).map((sug, i) => (
                                        <li key={i} className="bg-white border border-slate-200 p-3 rounded-lg text-xs font-medium text-slate-700 shadow-sm border-l-2 border-l-indigo-400">
                                            {sug}
                                        </li>
                                    ))}
                                    {m10Output.sugerenciasUniversal?.length === 0 && <li className="text-xs text-slate-400 italic">No hay sugerencias en este apartado.</li>}
                                </ul>
                            </div>

                            <div>
                                <h5 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3 flex items-center gap-1.5"><span className="text-rose-500">⚠️</span> Evitar o Precaución (Condicional)</h5>
                                <ul className="space-y-2">
                                    {(m10Output.sugerenciasCondicional || []).map((sug, i) => (
                                        <li key={i} className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-xs font-medium text-rose-800 shadow-sm border-l-2 border-l-rose-400">
                                            {sug}
                                        </li>
                                    ))}
                                    {m10Output.sugerenciasCondicional?.length === 0 && <li className="text-xs text-slate-400 italic">No hay limitantes sugeridas. Todo es seguro según triage.</li>}
                                </ul>
                            </div>

                        </div>
                    </div>
                ) : null}

            </div>
        </div>
    );
}
