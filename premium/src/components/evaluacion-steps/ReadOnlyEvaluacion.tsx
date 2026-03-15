import React from 'react';
import { Evaluacion } from '@/types/clinica';

interface ReadOnlyEvaluacionProps {
    evaluacion: Evaluacion;
    onClose: () => void;
    onEdit: () => void;
}

export function ReadOnlyEvaluacion({ evaluacion, onClose, onEdit }: ReadOnlyEvaluacionProps) {
    const renderContent = () => {
        if (evaluacion.type === 'INITIAL') {
            const ev = evaluacion as any;
            return (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Evaluación Inicial</h2>
                        <div className="text-sm text-slate-500 mb-4">
                            Fecha: {new Date(ev.sessionAt).toLocaleDateString()} | 
                            Kinesiólogo(a): {ev.clinicianResponsible}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-sm">
                                ✏️ Cargar Editor Completo
                            </button>
                            <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                                ✕ Cerrar Vista
                            </button>
                        </div>
                    </div>

                    {/* Resumen P1 AI / Motivo */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-base font-bold text-slate-800 mb-4 border-b pb-2">1. Motivo de Consulta y Anamnesis (P1)</h3>
                        {ev.interview?.v4?.p1_ai_structured ? (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700">Resumen Clínico</h4>
                                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{ev.interview.v4.p1_ai_structured.resumen_clinico_editable || 'Sin resumen estructurado'}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700">A la Persona Usuaria</h4>
                                    <p className="text-sm text-slate-600 italic">"Lo que entendí: {ev.interview.v4.p1_ai_structured.resumen_persona_usuaria?.lo_que_entendi}"</p>
                                    <p className="text-sm text-slate-600 italic">"Inquietud principal: {ev.interview.v4.p1_ai_structured.resumen_persona_usuaria?.lo_que_te_preocupa}"</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic">Resumen en texto clásico o no disponible: {ev.interview?.v4?.experienciaPersona?.relatoLibre || 'No hay relato'}</div>
                        )}
                    </div>

                    {/* Examen Físico (P2) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-base font-bold text-slate-800 mb-4 border-b pb-2">2. Examen Físico (P2)</h3>
                        {ev.autoSynthesis?.physicalSynthesis?.summary_text_short ? (
                            <p className="text-sm text-slate-600 whitespace-pre-wrap">
                                {ev.autoSynthesis.physicalSynthesis.summary_text_short}
                            </p>
                        ) : (
                            <div className="text-sm text-slate-500 italic">Información detallada en el Editor. (Click en Cargar Editor Completo para revisar módulos).</div>
                        )}
                    </div>

                    {/* Síntesis CIF (P3) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-base font-bold text-slate-800 mb-4 border-b pb-2">3. Síntesis CIF (P3)</h3>
                        {ev.autoSynthesis?.sistema_y_estructuras?.sistema_principal ? (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700">Sistema y Estructuras</h4>
                                    <p className="text-sm text-slate-600">{ev.autoSynthesis.sistema_y_estructuras.sistema_principal} - {ev.autoSynthesis.sistema_y_estructuras.estructura_principal}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700">Diagnóstico Terapéutico (Etiqueta principal)</h4>
                                    <p className="text-sm text-slate-600 font-medium text-emerald-700">{ev.autoSynthesis.clasificacion_dolor?.categoria_principal} - {ev.autoSynthesis.clasificacion_dolor?.subtipo_apellido}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic">Sin datos CIF procesados.</div>
                        )}
                    </div>

                    {/* Diagnóstico Narrativo y Plan (P4) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-base font-bold text-slate-800 mb-4 border-b pb-2">4. Diagnóstico Clínico Integral y Plan (P4)</h3>
                        {ev.p4_plan_structured ? (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700">Diagnóstico Narrativo</h4>
                                    <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{ev.p4_plan_structured.diagnostico_kinesiologico_narrativo}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700">Plan Maestro</h4>
                                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{ev.p4_plan_structured.plan_maestro}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700">Objetivo General</h4>
                                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{ev.p4_plan_structured.objetivo_general?.seleccionado || "No seleccionado"}</p>
                                </div>
                                {ev.p4_plan_structured.objetivos_smart && ev.p4_plan_structured.objetivos_smart.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Objetivos SMART</h4>
                                        <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                                            {ev.p4_plan_structured.objetivos_smart.map((obj: any, idx: number) => (
                                                <li key={idx}><span className="font-semibold">{obj.texto}</span> (Meta: {obj.meta} en {obj.plazo})</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : ev.geminiDiagnostic?.narrativeDiagnosis ? (
                            <div>
                                <h4 className="text-sm font-semibold text-slate-700">Diagnóstico Narrativo (Legacy)</h4>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap">{ev.geminiDiagnostic.narrativeDiagnosis}</p>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic">No hay diagnóstico narrativo ni plan guardado.</div>
                        )}
                    </div>
                </div>
            );
        } else {
            // Reevaluacion
            const ev = evaluacion as any;
            return (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Re-Evaluación (Seguimiento)</h2>
                        <div className="text-sm text-slate-500 mb-4">
                            Fecha: {new Date(ev.sessionAt).toLocaleDateString()} | 
                            Kinesiólogo(a): {ev.clinicianResponsible}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-sm">
                                ✏️ Cargar Editor Completo
                            </button>
                            <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                                ✕ Cerrar Vista
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-base font-bold text-slate-800 mb-4 border-b pb-2">Resumen de Seguimiento</h3>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{ev.reevaluation?.progressSummary || "Sin resumen."}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-base font-bold text-slate-800 mb-4 border-b pb-2">Ajustes Módulos y Plan</h3>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{ev.reevaluation?.planModifications || "Sin ajustes al plan maestro."}</p>
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-50/90 backdrop-blur w-screen h-[100dvh] overflow-y-auto animate-in fade-in flex justify-center p-4 sm:p-8">
            <div className="w-full max-w-4xl bg-transparent">
                {renderContent()}
                <div className="h-20"></div>
            </div>
        </div>
    );
}
