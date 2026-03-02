import React from "react";
import { Evaluacion } from "@/types/clinica";

interface M13Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
    validationContext: {
        hasMotivos: boolean;
        validMotivoSubj: boolean;
        validRedFlags: boolean;
        validPhysical: boolean;
        hasDx: boolean;
        validObjs: boolean;
        validPlan: boolean;
        allValid: boolean;
    };
    onSaveAndClose: () => void;
}

export function M13_Cierre({ formData, isClosed, validationContext, onSaveAndClose }: M13Props) {
    const vc = validationContext;

    const stopItems = [
        { key: 'motivos', label: 'Motivo de Consulta (M0)', icon: '⚡', valid: vc.hasMotivos, desc: 'Existe al menos un foco de evaluación.' },
        { key: 'triage', label: 'Triage & Conducta (M1)', icon: '🚩', valid: vc.validRedFlags, desc: 'Las banderas rojas marcadas tienen conducta justificada.' },
        { key: 'subj', label: 'Anamnesis Próxima (M2)', icon: '🗣️', valid: vc.validMotivoSubj, desc: 'Todos los motivos detallan mecanismo y limitación funcional.' },
        { key: 'phys', label: 'Examen Físico (M7)', icon: '🩺', valid: vc.validPhysical, desc: 'Los motivos tienen ROM, Fuerza o Pruebas medidas.' },
        { key: 'dx', label: 'Diagnóstico (M11)', icon: '📝', valid: vc.hasDx, desc: 'Diagnóstico kinésico narrativo redactado.' },
        { key: 'objs', label: 'Objetivos SMART (M12)', icon: '🎯', valid: vc.validObjs, desc: 'Existen objetivos (1 Gral, 2 Específicos).' },
        { key: 'plan', label: 'Plan Operativo (M12)', icon: '🛣️', valid: vc.validPlan, desc: 'Se ha planificado educación y/o intervenciones.' },
    ];

    const hasErrors = !vc.allValid;

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-2xl">✅</span>
                <div>
                    <h3 className="text-lg font-black text-slate-800">M13: Cierre y Consolidación</h3>
                    <p className="text-xs text-slate-500 font-medium">Revisa las alertas duras (Hard Stops) antes de fijar como inmutable.</p>
                </div>
            </div>

            <div className="bg-white border text-left border-slate-200 p-6 lg:p-8 rounded-2xl shadow-sm space-y-8">

                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="shrink-0 flex items-center justify-center w-24 h-24 rounded-full bg-slate-50 border-4 border-slate-100 relative">
                        {hasErrors ? (
                            <span className="text-5xl drop-shadow-sm">⛔</span>
                        ) : (
                            <span className="text-5xl drop-shadow-sm">🏆</span>
                        )}
                        {!isClosed && hasErrors && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow animate-bounce">Falta!</span>}
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        {isClosed ? (
                            <>
                                <h4 className="text-xl font-black text-slate-800 mb-2">Evaluación Cerrada Oficialmente</h4>
                                <p className="text-sm text-slate-500">Esta evaluación clínica fue sellada y no permite modificaciones directas en Anamnesis o Examen Físico inicial para proteger la integridad legal del documento.</p>
                            </>
                        ) : hasErrors ? (
                            <>
                                <h4 className="text-xl font-black text-rose-800 mb-2">Hard Stops Pendientes</h4>
                                <p className="text-sm text-rose-600/80 font-medium">No es posible fijar la evaluación. Faltan antecedentes mínimos para asegurar calidad clínica. Revisa el listado a continuación.</p>
                            </>
                        ) : (
                            <>
                                <h4 className="text-xl font-black text-emerald-800 mb-2">Evaluación Impecable, Lista para Cierre</h4>
                                <p className="text-sm text-emerald-600/80 font-medium">Todos los parámetros estructurales mínimos han sido cubiertos. Ya puedes sellar el registro formalmente.</p>
                                <button
                                    onClick={onSaveAndClose}
                                    className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm transition-all text-sm w-full md:w-auto flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    Cerrar y Sellar Registro
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 lg:p-6">
                    <h5 className="text-sm font-bold text-slate-700 mb-4 items-center gap-2 flex"><span className="text-lg">🚦</span> Panel de Completitud Semántica</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {stopItems.map(item => (
                            <div key={item.key} className={`flex items-start gap-3 p-3 border rounded-xl transition-colors ${item.valid ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100 shadow-sm'}`}>
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${item.valid ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {item.valid ? '✓' : '✗'}
                                </div>
                                <div>
                                    <h6 className={`text-[11px] font-black uppercase tracking-wider mb-0.5 ${item.valid ? 'text-emerald-800' : 'text-rose-800'}`}>
                                        {item.icon} {item.label}
                                    </h6>
                                    <p className={`text-[10px] leading-tight font-medium ${item.valid ? 'text-emerald-600/70' : 'text-rose-600/80'}`}>
                                        {item.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
