import React from "react";
import { Evaluacion } from "@/types/clinica";

interface MReevalProps {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    onProceed: () => void;
}

export function M_ReevalStart({ formData, updateFormData, onProceed }: MReevalProps) {

    const dxResumen = formData.dxKinesico?.narrative || formData.clinicalSynthesis || 'Sin diagnóstico previo registrado.';

    const handleExpressMode = () => {
        // En modo expreso, asumiremos que nada ha cambiado excepto el dolor actual y los tests reevaluables.
        // Podríamos setear un flag en formData para que el UI oculte pasos.
        updateFormData({
            ai: {
                ...(formData.ai || {}),
                appliedFlags: {
                    ...(formData.ai?.appliedFlags || {}),
                    expressReeval: true
                }
            }
        });
        onProceed();
    };

    const handleFullMode = () => {
        // Modo completo: el clínico navegará por los 13 pasos para revalidar todo.
        updateFormData({
            ai: {
                ...(formData.ai || {}),
                appliedFlags: {
                    ...(formData.ai?.appliedFlags || {}),
                    expressReeval: false
                }
            }
        });
        onProceed();
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-2xl">🔄</span>
                <div>
                    <h3 className="text-lg font-black text-indigo-900">Bienvenido a la Reevaluación</h3>
                    <p className="text-xs text-indigo-700/70 font-medium">Revisa el caso base y decide qué flujo de abordaje utilizarás hoy.</p>
                </div>
            </div>

            <div className="bg-white border text-left border-indigo-100 p-6 lg:p-8 rounded-2xl shadow-sm space-y-6">

                {/* Dashboard Resumen Baseline */}
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Snapshot del Estado Previo</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold mb-1">Diagnóstico Kinésico Narrativo Base</p>
                            <p className="text-xs text-slate-800 font-medium leading-relaxed bg-white p-3 rounded-lg border border-slate-100 shadow-sm">{dxResumen}</p>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold mb-1">Motivos Abiertos Previos</p>
                                <ul className="list-disc pl-4 text-xs text-slate-800 font-medium">
                                    {(formData.motivos || []).map(m => (
                                        <li key={m.id}>{m.motivoLabel || 'Motivo sin nombrar'}</li>
                                    ))}
                                    {(formData.motivos?.length === 0) && <li className="text-slate-400 italic list-none -ml-4">No hay motivos documentados.</li>}
                                </ul>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold mb-1">Focos Físicos a Retestear Recomendados</p>
                                <ul className="pl-4 text-xs text-slate-800 font-medium space-y-1">
                                    {(formData.motivos || []).map(m => {
                                        const cSigns = [];
                                        if (m.comparableSign?.asteriscoPrincipal?.tipo) cSigns.push(m.comparableSign.asteriscoPrincipal.tipo);
                                        return cSigns.map((cs, i) => (
                                            <li key={i} className="flex items-center gap-1.5"><span className="text-amber-500">⭐</span> {cs}</li>
                                        ));
                                    })}
                                    {!(formData.motivos || []).some(m => m.comparableSign?.asteriscoPrincipal?.tipo) && <li className="text-slate-400 italic list-none -ml-4">Sin 'Comparable Signs' base.</li>}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Elección de Flujo */}
                <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-3">¿Han habido cambios sintomáticos groseros o nuevos eventos traumáticos?</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <button
                            onClick={handleExpressMode}
                            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 p-5 rounded-xl text-left transition-colors group"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h5 className="font-bold text-emerald-900 group-hover:text-emerald-700 transition-colors">👉 No, Sin Cambios Groseros (Flujo Expreso)</h5>
                                <span className="text-xl">🏃‍♂️</span>
                            </div>
                            <p className="text-xs text-emerald-800/70 font-medium leading-snug">Se omitirá Anamnesis Próxima y Factores BPS completos. Saltarás directo a actualizar el dolor, retestear Función (PSFS) e ir directo al Examen Físico y Comparable Sign.</p>
                        </button>

                        <button
                            onClick={handleFullMode}
                            className="bg-amber-50 hover:bg-amber-100 border border-amber-200 p-5 rounded-xl text-left transition-colors group"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h5 className="font-bold text-amber-900 group-hover:text-amber-700 transition-colors">👉 Sí, Hubo Cambios (Flujo Completo)</h5>
                                <span className="text-xl">🕵️‍♂️</span>
                            </div>
                            <p className="text-xs text-amber-800/70 font-medium leading-snug">El paciente reporta un nuevo mecanismo de lesión, cirugía, exacerbación severa o banderas rojas nuevas. Validarás todos los pasos de la anamnesis.</p>
                        </button>

                    </div>
                </div>

            </div>
        </div>
    );
}
