import React from 'react';
import { Evaluacion } from '@/types/clinica';
import { humanize } from '@/utils/humanizer';
import { formatSafeDate } from '@/lib/firebase-utils';

interface ReadOnlyEvaluacionProps {
    evaluacion: Evaluacion;
    usuariaName?: string;
    onClose: () => void;
    onEdit: () => void;
}

const InfoCard = ({ label, value, sub }: { label: string, value?: string, sub?: string }) => {
    if (!value || value === "No registrada" || value === "No definido") return null;
    return (
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
            <h4 className="text-[10px] uppercase text-slate-400 font-bold mb-1 tracking-wider">{label}</h4>
            <p className="text-sm text-slate-800 font-medium leading-snug">{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
    );
};

export function ReadOnlyEvaluacion({ evaluacion, usuariaName, onClose, onEdit }: ReadOnlyEvaluacionProps) {
    const renderContent = () => {
        if (evaluacion.type === 'INITIAL') {
            const ev = evaluacion as any;
            const p1 = ev.interview?.v4?.p1_ai_structured;
            const p15 = ev.remoteHistorySnapshot?.p15_context_structured;
            const p15_flags = ev.remoteHistorySnapshot?.p15_context_flags;
            const p2_text = ev.guidedExam?.autoSynthesis?.summary_text_structured || ev.autoSynthesis?.physicalSynthesis?.summary_text_structured;
            const p3 = ev.p3_case_organizer || ev.autoSynthesis;
            const p4 = ev.p4_plan_structured;

            return (
                <div className="space-y-6">
                    {/* Header Identificación */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-50"></div>
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Evaluación Inicial</h2>
                                <h3 className="text-lg font-medium text-slate-600 mt-1">{usuariaName || 'Sin Nombre'}</h3>
                                <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-3 text-sm font-medium text-slate-500">
                                    <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> {formatSafeDate(ev)}</span>
                                    <span className="hidden md:inline">•</span>
                                    <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> {ev.clinicianResponsible}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <button onClick={onEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center shadow-sm hover:shadow">
                                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Cargar Editor Completo
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 1. Motivo de Consulta y Anamnesis (P1) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-sm uppercase tracking-widest font-bold text-indigo-600 mb-5 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">1</span>
                            Anamnesis Próxima
                        </h3>
                        
                        {p1 ? (
                            <div className="space-y-6">
                                {/* Foco y Motivo */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                                        <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-1.5 tracking-wider">Motivo de Consulta Principal</h4>
                                        <p className="text-base text-slate-800 font-medium leading-relaxed">{p1.foco_principal?.queja_prioritaria || p1.resumen_persona_usuaria?.lo_que_te_preocupa}</p>
                                    </div>
                                    <div className="p-4 rounded-xl border border-slate-100 bg-gradient-to-br from-indigo-50/50 to-white shadow-sm">
                                        <h4 className="text-[11px] uppercase text-indigo-600 font-bold mb-1.5 tracking-wider">Expectativa Declarada</h4>
                                        <p className="text-base text-slate-800 font-medium leading-relaxed">{p1.foco_principal?.actividad_indice || p1.resumen_persona_usuaria?.lo_que_haremos_ahora}</p>
                                    </div>
                                </div>

                                {/* ALICIA Grid */}
                                {p1.alicia && (
                                    <>
                                        <h4 className="text-xs uppercase text-slate-400 font-bold tracking-widest border-b pb-2">Exploración del Síntoma</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            <InfoCard label="Antigüedad/Evolución" value={p1.alicia.antiguedad_inicio} />
                                            <InfoCard label="Localización" value={p1.alicia.localizacion_extension} />
                                            <InfoCard label="Mecanismo" value={p1.alicia.historia_mecanismo} />
                                            <InfoCard label="Naturaleza" value={p1.alicia.caracter_naturaleza} />
                                            <InfoCard label="Agravantes" value={p1.alicia.agravantes} />
                                            <InfoCard label="Atenuantes" value={p1.alicia.atenuantes} />
                                        </div>
                                    </>
                                )}

                                {/* Intensidad e Irritabilidad */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                     <InfoCard label="Intensidad Actual" value={p1.alicia?.intensidad_actual} />
                                     <InfoCard label="Peor 24h" value={p1.alicia?.intensidad_peor_24h} />
                                     <InfoCard label="Mejor 24h" value={p1.alicia?.intensidad_mejor_24h} />
                                     <InfoCard label="Irritabilidad Global" value={p1.sins?.irritabilidad_global?.toUpperCase()} />
                                </div>

                                {/* Banderas / Contexto Clínico (Si existen rojas o amarillas) */}
                                {p1.factores_contextuales_clave && (p1.factores_contextuales_clave.banderas_rojas?.length > 0 || p1.factores_contextuales_clave.banderas_amarillas?.length > 0) && (
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                        <h4 className="text-[11px] uppercase text-red-800 font-bold mb-2 tracking-wider">Alertas Clínicas Detectadas o Descartadas</h4>
                                        <div className="text-sm text-red-900 space-y-1.5">
                                            {p1.factores_contextuales_clave.banderas_rojas?.map((b: string, i: number) => <div key={`r-${i}`} className="flex items-start gap-2"><span className="shrink-0">🚩</span> <span>{b}</span></div>)}
                                            {p1.factores_contextuales_clave.banderas_amarillas?.map((b: string, i: number) => <div key={`y-${i}`} className="flex items-start gap-2"><span className="shrink-0">⚠️</span> <span>{b}</span></div>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : ev.interview?.v4?.experienciaPersona?.relatoLibre || ev.interview?.v4?.anamnesisProxima?.motivoPrincipalConsulta ? (
                            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{ev.interview.v4.experienciaPersona?.relatoLibre || ev.interview.v4.anamnesisProxima?.motivoPrincipalConsulta}</p>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic flex items-center justify-center gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                Sin antecedentes de anamnesis próximos registrados.
                            </div>
                        )}
                    </div>

                    {/* 1.5. Contexto Basal (P1.5) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-sm uppercase tracking-widest font-bold text-sky-600 mb-5 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-sky-700">1.5</span>
                            Contexto Basal Relevante
                        </h3>
                        {p15 ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <InfoCard label="Ocupación" value={humanize(p15.contexto_ocupacional?.ocupacion_principal)} sub={humanize(p15.contexto_ocupacional?.barreras_logisticas_adherencia?.[0])} />
                                <InfoCard label="Actividad/Deporte" value={humanize(p15.deporte_actividad_basal?.actividad_deporte_central)} sub={humanize(p15.deporte_actividad_basal?.nivel_practica_actual)} />
                                <InfoCard label="Calidad Sueño" value={humanize(p15.biopsicosocial_habitos?.calidad_sueno)} />
                                <InfoCard label="Estrés" value={humanize(p15.biopsicosocial_habitos?.estres_basal)} />
                                {p15.antecedentes_msk?.lesiones_previas?.length > 0 && (
                                     <InfoCard label="Lesiones Previas" value={p15.antecedentes_msk.lesiones_previas.map(humanize).join(', ')} />
                                )}
                                {p15.antecedentes_msk?.cirugias_previas?.length > 0 && (
                                     <InfoCard label="Cirugías" value={p15.antecedentes_msk.cirugias_previas.map(humanize).join(', ')} />
                                )}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic flex items-center gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <span>📋</span> Sin anamnesis remota (P1.5) registrada en este momento.
                            </div>
                        )}
                    </div>

                    {/* 2. Examen Físico (P2) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-sm uppercase tracking-widest font-bold text-amber-600 mb-5 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">2</span>
                            Examen Físico
                        </h3>
                        {p2_text ? (
                            <div className="p-5 rounded-xl border border-slate-100 bg-amber-50/30">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                    {p2_text}
                                </p>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic flex items-center justify-center gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                Examen físico aún no sintetizado.
                            </div>
                        )}
                    </div>

                    {/* 3. Síntesis CIF (P3) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-sm uppercase tracking-widest font-bold text-teal-600 mb-5 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-700">3</span>
                            Síntesis Clínica y CIF
                        </h3>
                        {p3?.clasificacion_dolor ? (
                            <div className="space-y-4">
                                {/* Pain Classification */}
                                <div className="bg-teal-50 p-5 rounded-xl border border-teal-100">
                                    <h4 className="text-[11px] uppercase text-teal-800 font-bold mb-1 tracking-wider">Diagnóstico Terapéutico</h4>
                                    <div className="text-lg font-bold text-teal-900">{p3.clasificacion_dolor.categoria_seleccionada}</div>
                                    <div className="text-sm font-semibold text-teal-700 mt-1">{p3.clasificacion_dolor.subtipo_seleccionado}</div>
                                    <p className="text-sm text-teal-800/80 mt-2 font-medium leading-relaxed">{p3.clasificacion_dolor.fundamento_breve}</p>
                                </div>

                                {/* Sistema y Estructuras */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                          <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Sistema y Estructuras</h4>
                                          <p className="text-base text-slate-800 font-bold">{p3.sistema_y_estructuras?.sistemas_principales?.join(', ')}</p>
                                          <p className="text-sm text-slate-700 font-medium">{p3.sistema_y_estructuras?.estructuras_principales?.join(', ')}</p>
                                          {p3.sistema_y_estructuras?.estructuras_secundarias?.length > 0 && (
                                            <p className="text-xs text-slate-500 mt-2"><span className="font-semibold">Secundarias:</span> {p3.sistema_y_estructuras.estructuras_secundarias.join(', ')}</p>
                                          )}
                                     </div>
                                     
                                     {/* Alteraciones Funcionales */}
                                     {p3.alteraciones_detectadas?.functional?.length > 0 && (
                                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                              <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Alt. Detectadas Principales</h4>
                                              <ul className="text-sm text-slate-700 list-disc pl-4 space-y-1.5">
                                                  {p3.alteraciones_detectadas.functional.slice(0,3).map((f:any, i:number) => <li key={`f-${i}`}>{f.texto}</li>)}
                                                  {p3.alteraciones_detectadas.estructurales?.slice(0,2).map((f:any, i:number) => <li key={`e-${i}`}>{f.texto}</li>)}
                                              </ul>
                                         </div>
                                     )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic flex items-center justify-center gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                Sin síntesis CIF procesada.
                            </div>
                        )}
                    </div>

                    {/* 4. Diagnóstico Narrativo y Plan (P4) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-sm uppercase tracking-widest font-bold text-rose-600 mb-5 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-rose-700">4</span>
                            Diagnóstico Integral y Plan
                        </h3>
                        {p4 ? (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider border-b pb-2">Diagnóstico Kinesiológico Narrativo</h4>
                                    <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">{p4.diagnostico_kinesiologico_narrativo}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                        <h4 className="text-[11px] uppercase text-rose-800 font-bold mb-2 tracking-wider">Pronóstico Biopsicosocial</h4>
                                        <div className="font-bold text-rose-900 uppercase text-sm mb-1">{p4.pronostico_biopsicosocial?.categoria}</div>
                                        <p className="text-sm text-rose-800/90 leading-relaxed">{p4.pronostico_biopsicosocial?.justificacion_clinica_integral}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Plan Maestro</h4>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{p4.plan_maestro}</p>
                                    </div>
                                </div>

                                {p4.objetivos_smart && p4.objetivos_smart.length > 0 && (
                                    <div>
                                        <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-3 tracking-wider border-b pb-2">Objetivos SMART</h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            {p4.objetivos_smart.map((obj: any, idx: number) => (
                                                <div key={idx} className="flex gap-3 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                    <div className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{idx + 1}</div>
                                                    <div className="text-sm text-slate-700">
                                                        <span className="font-bold">{obj.texto}</span>
                                                        <span className="text-slate-500 ml-2">(Plazo: {obj.plazo})</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : ev.geminiDiagnostic?.narrativeDiagnosis ? (
                            <div>
                                <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider border-b pb-2">Diagnóstico Narrativo (Legacy)</h4>
                                <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{ev.geminiDiagnostic.narrativeDiagnosis}</p>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 italic flex items-center justify-center gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                Diagnóstico y plan aún no sintetizados.
                            </div>
                        )}
                    </div>
                    
                    <div className="flex justify-center pt-4 pb-8">
                        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-3 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-slate-200">
                            Terminar Lectura
                        </button>
                    </div>

                </div>
            );
        } else {
            // Reevaluacion
            const ev = evaluacion as any;
            return (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 opacity-50"></div>
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Re-Evaluación (Seguimiento)</h2>
                                <h3 className="text-lg font-medium text-slate-600 mt-1">{usuariaName || 'Sin Nombre'}</h3>
                                <div className="flex items-center gap-4 mt-3 text-sm font-medium text-slate-500">
                                    <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> {new Date(ev.sessionAt).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> {ev.clinicianResponsible}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <button onClick={onEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center shadow-sm">
                                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Cargar Editor Completo
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-sm uppercase tracking-widest font-bold text-emerald-600 mb-5 flex items-center gap-2 border-b pb-3">Resumen de Seguimiento</h3>
                        <p className="text-base text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{ev.reevaluation?.progressSummary || "Sin resumen."}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-sm uppercase tracking-widest font-bold text-emerald-600 mb-5 flex items-center gap-2 border-b pb-3">Ajustes Módulos y Plan</h3>
                        <p className="text-base text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{ev.reevaluation?.planModifications || "Sin ajustes al plan maestro."}</p>
                    </div>
                    
                    <div className="flex justify-center pt-4 pb-8">
                        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-3 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-slate-200">
                            Terminar Lectura
                        </button>
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-100/95 backdrop-blur-sm w-screen h-[100dvh] overflow-y-auto animate-in fade-in flex justify-center p-4 sm:p-8">
            <div className="w-full max-w-4xl bg-transparent mt-[2vh]">
                <button onClick={onClose} className="mb-4 text-slate-500 hover:text-slate-800 font-medium text-sm flex items-center gap-1 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Volver a la línea de tiempo
                </button>
                {renderContent()}
            </div>
        </div>
    );
}
