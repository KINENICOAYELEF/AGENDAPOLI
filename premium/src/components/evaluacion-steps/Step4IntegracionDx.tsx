import React from "react";
import { Evaluacion } from "@/types/clinica";

export function Step4IntegracionDx({
    formData,
    updateFormData,
    isClosed,
    setAiLoading,
    setAiError,
    aiLoading
}: {
    formData: Partial<Evaluacion>,
    updateFormData: (patch: any) => void,
    isClosed: boolean,
    setAiLoading: (val: string | null) => void,
    setAiError: (val: string | null) => void,
    aiLoading: string | null
}) {

    const handleGeminiSuggestEvaluacion = async (actionType: 'generarSintesisEvaluacion' | 'generarDxKinesiologico') => {
        try {
            setAiLoading(actionType);
            setAiError(null);

            // Contexto rico estructural para Gemini FASE 2.2.1
            const payloadContext = {
                tipo: formData.type,
                motivosEvaluados: formData.motivos || [],
            };

            const response = await fetch('/api/ai/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: actionType, context: payloadContext })
            });

            if (!response.ok) throw new Error("Error en API de Gemini");

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (data.result) {
                if (actionType === 'generarSintesisEvaluacion') {
                    updateFormData((p: any) => ({ ...p, integration: { ...p.integration, synthesis: data.result } }));
                }
                if (actionType === 'generarDxKinesiologico') {
                    updateFormData((p: any) => ({ ...p, dxKinesico: { ...p.dxKinesico, primary: data.result } }));
                }
            }
        } catch (error: any) {
            console.error(error);
            setAiError("La magia falló. Revisa tu conexión u omitamos la sugerencia por ahora.");
        } finally {
            setAiLoading(null);
        }
    };

    const getAiButton = (actionTarget: 'generarSintesisEvaluacion' | 'generarDxKinesiologico', label: string) => {
        if (isClosed) return null;
        const isLoading = aiLoading === actionTarget;
        return (
            <button
                onClick={(e) => { e.preventDefault(); handleGeminiSuggestEvaluacion(actionTarget); }}
                disabled={isLoading || !!aiLoading}
                className="mt-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-all flex items-center gap-1 shadow-sm w-fit"
            >
                {isLoading ? (
                    <svg className="animate-spin h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    <span className="text-xl leading-none">✨</span>
                )}
                {label}
            </button>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <span className="text-2xl leading-none">🧠</span>
                    4. Integración Biopsicosocial
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Sintetiza el caso e infiere el diagnóstico kinesiológico.</p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 md:p-6 space-y-8">

                {/* Síntesis BPS */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Síntesis Clínica y Análisis BPS <span className="text-indigo-400 font-normal text-[10px] tracking-widest ml-1 uppercase">(Opcional IA)</span></label>
                    <textarea
                        rows={5}
                        value={formData.integration?.synthesis || formData.clinicalSynthesis || ''}
                        onChange={e => updateFormData((p: any) => ({ ...p, integration: { ...p.integration, synthesis: e.target.value } }))}
                        disabled={isClosed}
                        placeholder="Redacte la integración de los hallazgos objetivos y el relato subjetivo..."
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:border-indigo-400 outline-none resize-none bg-slate-50"
                    />
                    {getAiButton('generarSintesisEvaluacion', 'Auto-Redactar Resumen Integral (Gemini)')}
                </div>

                {/* Dx Kinesico */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Diagnóstico Kinesiológico / Funcional <span className="text-rose-500 font-normal text-[10px] tracking-widest ml-1 uppercase">(Obligatorio)</span></label>
                    <textarea
                        rows={4}
                        value={formData.dxKinesico?.primary || formData.dxKinesiologico || ''}
                        onChange={e => updateFormData((p: any) => ({ ...p, dxKinesico: { ...p.dxKinesico, primary: e.target.value } }))}
                        disabled={isClosed}
                        placeholder="Ej. Disfunción patelofemoral derecha secundaria a valgo dinámico alterado..."
                        className="w-full border border-sky-200 rounded-2xl px-4 py-3 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none resize-none bg-sky-50/40 text-sky-900 font-medium"
                    />
                    {getAiButton('generarDxKinesiologico', 'Inferir Dx Estructural (Gemini)')}
                </div>

            </div>
        </div>
    );
}
