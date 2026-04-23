import React from 'react';
import { Evaluacion } from '@/types/clinica';
import { humanize, humanizeKey, hiddenKeys } from '@/utils/humanizer';
import { formatSafeDate } from '@/lib/firebase-utils';

interface ReadOnlyEvaluacionProps {
    evaluacion: Evaluacion;
    usuariaName?: string;
    onClose: () => void;
    onEdit: () => void;
}

// Renderizador recursivo elegante — usa humanize/humanizeKey para lectura clínica
const StructuredDataRenderer = ({ data, level = 0 }: { data: any, level?: number }) => {
    if (data === null || data === undefined || data === '') return null;
    
    if (Array.isArray(data)) {
        if (data.length === 0) return null;
        if (data.every(val => typeof val !== 'object')) {
            return (
                <ul className="list-disc pl-4 space-y-1">
                    {data.map((item, idx) => (
                        <li key={idx} className="text-xs text-slate-600 font-medium leading-relaxed">{humanize(item)}</li>
                    ))}
                </ul>
            );
        }
        return (
            <div className="space-y-3 mt-1 w-full">
                {data.map((item, idx) => (
                    <div key={idx} className={`relative pt-1 pb-2 w-full ${level > 0 ? 'border-l-2 border-indigo-100 pl-3' : 'bg-white p-3 rounded-lg border border-slate-100 shadow-sm'}`}>
                        {data.length > 1 && level > 0 && <div className="absolute top-[14px] -left-[5px] w-2 h-2 rounded-full bg-indigo-200"></div>}
                        <StructuredDataRenderer data={item} level={level + 1} />
                    </div>
                ))}
            </div>
        );
    }
    
    if (typeof data === 'object') {
        const entries = Object.entries(data).filter(([key, val]) => {
            if (val === null || val === undefined || val === '') return false;
            if (Array.isArray(val) && val.length === 0) return false;
            if (hiddenKeys.has(key)) return false;
            return true;
        });
        
        if (entries.length === 0) return null;

        return (
            <div className="flex flex-col gap-2 w-full overflow-hidden">
                {entries.map(([key, val], idx) => {
                    const label = humanizeKey(key);
                    const isSimpleValue = typeof val !== 'object';
                    
                    return (
                        <div key={idx} className={`flex w-full ${isSimpleValue ? 'flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2' : 'flex-col gap-1.5'}`}>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest shrink-0 break-words mt-0.5">
                                {label}:
                            </span>
                            <div className="w-full flex-1 min-w-0">
                                {isSimpleValue ? (
                                    <span className="text-xs text-slate-800 font-medium break-words leading-relaxed block">{typeof val === 'boolean' ? (val ? 'Sí' : 'No') : humanize(String(val))}</span>
                                ) : (
                                    <div className="w-full overflow-hidden">
                                        <StructuredDataRenderer data={val} level={level + 1} />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }
    
    return <span className="text-xs text-slate-800 font-medium break-words leading-relaxed">{humanize(String(data))}</span>;
};

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
                            <>
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

                                {/* Banderas / Contexto Clínico */}
                                {p1.factores_contextuales_clave && (p1.factores_contextuales_clave.banderas_rojas?.length > 0 || p1.factores_contextuales_clave.banderas_amarillas?.length > 0) && (
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                        <h4 className="text-[11px] uppercase text-red-800 font-bold mb-2 tracking-wider">Alertas Clínicas Detectadas o Descartadas</h4>
                                        <div className="text-sm text-red-900 space-y-1.5">
                                            {p1.factores_contextuales_clave.banderas_rojas?.map((b: string, i: number) => <div key={`r-${i}`} className="flex items-start gap-2"><span className="shrink-0">🚩</span> <span>{b}</span></div>)}
                                            {p1.factores_contextuales_clave.banderas_amarillas?.map((b: string, i: number) => <div key={`y-${i}`} className="flex items-start gap-2"><span className="shrink-0">⚠️</span> <span>{b}</span></div>)}
                                        </div>
                                    </div>
                                )}

                                {/* Resumen Clínico IA */}
                                {(p1.resumen_clinico_breve || p1.resumen_clinico) && (
                                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                        <h4 className="text-[11px] uppercase text-indigo-600 font-bold mb-2 tracking-wider">Resumen Clínico</h4>
                                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{p1.resumen_clinico_breve || p1.resumen_clinico}</p>
                                    </div>
                                )}

                                {/* Hipótesis Orientativas */}
                                {(p1.hipotesis_orientativas?.length > 0) && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Hipótesis Orientativas</h4>
                                        <div className="space-y-2">
                                            {p1.hipotesis_orientativas.map((h: any, i: number) => (
                                                <div key={i} className="flex items-start gap-2 text-sm">
                                                    <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i+1}</span>
                                                    <div><span className="font-bold text-slate-800">{h.titulo || h.nombre}</span>{h.explicacion && <span className="text-slate-500 ml-1">— {h.explicacion}</span>}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* --- DATOS CRUDOS V4 (Focos, BPS, Seguridad, Contexto) --- */}
                            {(() => {
                                const v4 = ev.interview?.v4;
                                if (!v4) return null;
                                return (
                                    <div className="space-y-5 mt-2">
                                        {/* Relato Libre */}
                                        {v4.experienciaPersona?.relatoLibre && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Relato de la Persona</h4>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed italic">&ldquo;{v4.experienciaPersona.relatoLibre}&rdquo;</p>
                                            </div>
                                        )}

                                        {/* Focos Clínicos */}
                                        {v4.focos?.length > 0 && (
                                            <div>
                                                <h4 className="text-xs uppercase text-indigo-500 font-bold tracking-widest border-b pb-2 mb-3">Focos Clínicos ({v4.focos.length})</h4>
                                                <div className="space-y-4">
                                                    {v4.focos.map((f: any, fi: number) => (
                                                        <div key={fi} className={`p-4 rounded-xl border shadow-sm ${f.esPrincipal ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                {f.esPrincipal && <span className="bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Principal</span>}
                                                                <span className="font-bold text-slate-800">{f.region}</span>
                                                                <span className="text-xs text-slate-500">({humanize(f.lado)})</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                                                <InfoCard label="Inicio" value={humanize(f.inicio)} />
                                                                <InfoCard label="Antigüedad" value={f.antiguedad} />
                                                                <InfoCard label="Evolución" value={humanize(f.evolucion)} />
                                                                <InfoCard label="Episodios Previos" value={humanize(f.episodiosPrevios)} />
                                                            </div>
                                                            {f.contextoDetallado && <p className="text-xs text-slate-600 mb-2"><span className="font-bold text-slate-500">Contexto:</span> {f.contextoDetallado}</p>}
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                                                                <InfoCard label="Dolor Actual" value={f.dolorActual != null ? `${f.dolorActual}/10` : '-'} />
                                                                <InfoCard label="Mejor 24h" value={f.mejor24h != null ? `${f.mejor24h}/10` : '-'} />
                                                                <InfoCard label="Peor 24h" value={f.peor24h != null ? `${f.peor24h}/10` : '-'} />
                                                                <InfoCard label="En Actividad" value={f.dolorActividadIndice != null ? `${f.dolorActividadIndice}/10` : '-'} sub={f.actividadIndice} />
                                                            </div>
                                                            {f.naturaleza?.length > 0 && (
                                                                <div className="mb-2"><span className="text-[9px] font-bold text-slate-400 uppercase">Naturaleza:</span> <span className="text-xs text-slate-600">{f.naturaleza.join(', ')}</span></div>
                                                            )}
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {f.agravantes && <div><span className="text-[9px] font-bold text-slate-400 uppercase block">Agravantes</span><span className="text-xs text-slate-600">{f.agravantes}</span></div>}
                                                                {f.aliviantes && <div><span className="text-[9px] font-bold text-slate-400 uppercase block">Aliviantes</span><span className="text-xs text-slate-600">{f.aliviantes}</span></div>}
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                                                <InfoCard label="Extensión" value={humanize(f.extension)} />
                                                                <InfoCard label="Profundidad" value={humanize(f.profundidad)} />
                                                                <InfoCard label="Irritabilidad" value={humanize(f.irritabilidadAuto?.nivel)} sub={f.irritabilidadAuto?.explicacion?.substring(0,60)} />
                                                                <InfoCard label="Mecanismo Dolor" value={humanize(f.mecanismoCategoria)} sub={f.mecanismoApellido} />
                                                            </div>
                                                            {f.signoComparable && <div className="mt-2"><span className="text-[9px] font-bold text-slate-400 uppercase block">Signo Comparable</span><span className="text-xs text-slate-700 font-medium">{f.signoComparable} {f.dolorEnSigno != null ? `(Dolor: ${f.dolorEnSigno}/10)` : ''}</span></div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* PSFS Global */}
                                        {v4.psfsGlobal?.length > 0 && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Escala Funcional (PSFS)</h4>
                                                <div className="space-y-1.5">
                                                    {v4.psfsGlobal.filter((p: any) => p.actividad).map((p: any, i: number) => (
                                                        <div key={i} className="flex items-center justify-between text-sm bg-white p-2 rounded-lg border border-slate-100">
                                                            <span className="text-slate-700 font-medium">{p.actividad}</span>
                                                            <span className={`font-bold px-2 py-0.5 rounded text-xs ${(p.score ?? 0) <= 3 ? 'bg-rose-100 text-rose-700' : (p.score ?? 0) <= 6 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{p.score ?? '?'}/10</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {v4.objetivoPersona && <p className="text-xs text-slate-600 mt-2"><span className="font-bold">Objetivo:</span> {v4.objetivoPersona} {v4.plazoEsperado ? `(Plazo: ${v4.plazoEsperado})` : ''}</p>}
                                            </div>
                                        )}

                                        {/* Experiencia Persona - Objetivos */}
                                        {v4.experienciaPersona?.objetivos?.length > 0 && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Objetivos de la Persona</h4>
                                                <div className="space-y-2">
                                                    {v4.experienciaPersona.objetivos.map((o: any, i: number) => (
                                                        <div key={i} className="flex items-start gap-2 text-sm bg-white p-2.5 rounded-lg border border-slate-100">
                                                            {o.esPrincipal && <span className="bg-indigo-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 mt-0.5">Ppal</span>}
                                                            <div>
                                                                <span className="font-medium text-slate-800">{o.verbo ? `${o.verbo} ` : ''}{o.actividad}</span>
                                                                {o.contexto?.length > 0 && <span className="text-xs text-slate-500 ml-1">({o.contexto.join(', ')})</span>}
                                                                {o.plazoSemanas && <span className="text-xs text-slate-400 ml-1">· {o.plazoSemanas} sem</span>}
                                                                {o.enSusPalabras && <p className="text-xs text-slate-500 italic mt-0.5">&ldquo;{o.enSusPalabras}&rdquo;</p>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* BPS */}
                                        {v4.bps && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Perfil Biopsicosocial (BPS)</h4>
                                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                                    {[['sueno','Sueño'],['estres','Estrés'],['miedoMoverCargar','Kinesiofobia'],['preocupacionDano','Preocupación Daño'],['confianzaBaja','Baja Autoeficacia'],['frustracion','Frustración']].map(([k,label]) => {
                                                        const val = (v4.bps as any)[k];
                                                        if (val === undefined || val === null) return null;
                                                        return <InfoCard key={k} label={label} value={`${val}/2`} />;
                                                    })}
                                                </div>
                                                {v4.bps.otros && <p className="text-xs text-slate-600 mt-2"><span className="font-bold">Otros:</span> {v4.bps.otros}</p>}
                                            </div>
                                        )}

                                        {/* Seguridad */}
                                        {v4.seguridad && (
                                            <div className={`p-4 rounded-xl border ${(v4.seguridad.fiebre_sistemico_cancerPrevio || v4.seguridad.neuroGraveProgresivo_esfinteres_sillaMontar || v4.seguridad.sospechaFractura_incapacidadCarga) ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
                                                <h4 className="text-[11px] uppercase font-bold mb-2 tracking-wider text-slate-600">Screening de Seguridad</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                                                    {[['fiebre_sistemico_cancerPrevio','Fiebre / Sistémico / Cáncer previo'],['bajaPeso_noIntencionada','Baja de peso no intencionada'],['dolorNocturno_inexplicable_noMecanico','Dolor nocturno no mecánico'],['trauma_altaEnergia_caidaImportante','Trauma alta energía'],['neuroGraveProgresivo_esfinteres_sillaMontar','Neuro grave progresivo'],['sospechaFractura_incapacidadCarga','Sospecha fractura'],['riesgoEmocionalAgudo','Riesgo emocional agudo']].map(([k,label]) => {
                                                        const val = (v4.seguridad as any)[k];
                                                        if (val === undefined) return null;
                                                        return <div key={k} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded-full shrink-0 ${val ? 'bg-red-500' : 'bg-emerald-400'}`}></span><span className="text-slate-700">{label}</span></div>;
                                                    })}
                                                </div>
                                                {v4.seguridad.detalleBanderas && <p className="text-xs text-slate-600 mt-2 italic">{v4.seguridad.detalleBanderas}</p>}
                                            </div>
                                        )}

                                        {/* Contexto Deportivo */}
                                        {v4.contextoDeportivo?.aplica && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Contexto Deportivo</h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    <InfoCard label="Deporte" value={v4.contextoDeportivo.deportePrincipal} />
                                                    <InfoCard label="Nivel" value={humanize(v4.contextoDeportivo.nivel)} />
                                                    <InfoCard label="Hrs/Semana" value={v4.contextoDeportivo.horasSemanales != null ? String(v4.contextoDeportivo.horasSemanales) : '-'} />
                                                    <InfoCard label="Objetivo Retorno" value={humanize(v4.contextoDeportivo.objetivoRetorno)} />
                                                </div>
                                                {v4.contextoDeportivo.cambioBruscoCarga === 'Sí' && <p className="text-xs text-amber-700 font-bold mt-2">⚠️ Cambio brusco de carga reportado{v4.contextoDeportivo.notaCarga ? `: ${v4.contextoDeportivo.notaCarga}` : ''}</p>}
                                            </div>
                                        )}

                                        {/* Contexto Laboral */}
                                        {v4.contextoLaboral && (v4.contextoLaboral.trabajoDificultaRecuperacion || v4.contextoLaboral.temorEmpeorarTrabajo || v4.contextoLaboral.barrerasReales) && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Contexto Laboral</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                                    {v4.contextoLaboral.trabajoDificultaRecuperacion && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span><span>Trabajo dificulta recuperación</span></div>}
                                                    {v4.contextoLaboral.temorEmpeorarTrabajo && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span><span>Temor a empeorar en trabajo</span></div>}
                                                    {v4.contextoLaboral.barrerasReales && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span><span>Barreras reales: {v4.contextoLaboral.barrerasDetalles?.join(', ')}</span></div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            </>
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
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <InfoCard label="Ocupación" value={humanize(p15.contexto_ocupacional?.ocupacion_principal)} sub={humanize(p15.contexto_ocupacional?.barreras_logisticas_adherencia?.[0])} />
                                    <InfoCard label="Actividad/Deporte" value={humanize(p15.deporte_actividad_basal?.actividad_deporte_central)} sub={humanize(p15.deporte_actividad_basal?.nivel_practica_actual)} />
                                    <InfoCard label="Calidad Sueño" value={humanize(p15.biopsicosocial_habitos?.calidad_sueno)} />
                                    <InfoCard label="Estrés" value={humanize(p15.biopsicosocial_habitos?.estres_basal)} />
                                </div>

                                {/* Antecedentes MSK */}
                                {(p15.antecedentes_msk?.lesiones_previas?.length > 0 || p15.antecedentes_msk?.cirugias_previas?.length > 0 || p15.antecedentes_msk?.secuelas_persistentes?.length > 0) && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Antecedentes Musculoesqueléticos</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {p15.antecedentes_msk.lesiones_previas?.length > 0 && <div><span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Lesiones Previas</span><ul className="text-xs text-slate-600 list-disc pl-3 space-y-0.5">{p15.antecedentes_msk.lesiones_previas.map((l: string, i: number) => <li key={i}>{humanize(l)}</li>)}</ul></div>}
                                            {p15.antecedentes_msk.cirugias_previas?.length > 0 && <div><span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Cirugías</span><ul className="text-xs text-slate-600 list-disc pl-3 space-y-0.5">{p15.antecedentes_msk.cirugias_previas.map((c: string, i: number) => <li key={i}>{humanize(c)}</li>)}</ul></div>}
                                            {p15.antecedentes_msk.secuelas_persistentes?.length > 0 && <div><span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Secuelas</span><ul className="text-xs text-slate-600 list-disc pl-3 space-y-0.5">{p15.antecedentes_msk.secuelas_persistentes.map((s: string, i: number) => <li key={i}>{humanize(s)}</li>)}</ul></div>}
                                        </div>
                                    </div>
                                )}

                                {/* Comorbilidades / Medicamentos / Alergias */}
                                {(p15.factores_biologicos_relevantes?.comorbilidades_relevantes?.length > 0 || p15.factores_biologicos_relevantes?.medicacion_relevante?.length > 0 || p15.factores_biologicos_relevantes?.alergias_relevantes?.length > 0) && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Factores Biológicos Relevantes</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {p15.factores_biologicos_relevantes.comorbilidades_relevantes?.length > 0 && <div><span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Comorbilidades</span><ul className="text-xs text-slate-600 list-disc pl-3 space-y-0.5">{p15.factores_biologicos_relevantes.comorbilidades_relevantes.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul></div>}
                                            {p15.factores_biologicos_relevantes.medicacion_relevante?.length > 0 && <div><span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Medicamentos</span><ul className="text-xs text-slate-600 list-disc pl-3 space-y-0.5">{p15.factores_biologicos_relevantes.medicacion_relevante.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul></div>}
                                            {p15.factores_biologicos_relevantes.alergias_relevantes?.length > 0 && <div><span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Alergias</span><ul className="text-xs text-slate-600 list-disc pl-3 space-y-0.5">{p15.factores_biologicos_relevantes.alergias_relevantes.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul></div>}
                                        </div>
                                        {p15.factores_biologicos_relevantes.detalle_clinico_relevante && <p className="text-xs text-slate-600 mt-2 italic">{p15.factores_biologicos_relevantes.detalle_clinico_relevante}</p>}
                                    </div>
                                )}

                                {/* Contexto Domiciliario */}
                                {p15.contexto_domiciliario && (p15.contexto_domiciliario.vive_con || p15.contexto_domiciliario.tipo_vivienda) && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {p15.contexto_domiciliario.vive_con && <InfoCard label="Vive con" value={p15.contexto_domiciliario.vive_con} />}
                                        {p15.contexto_domiciliario.tipo_vivienda && <InfoCard label="Vivienda" value={humanize(p15.contexto_domiciliario.tipo_vivienda)} />}
                                        {p15.contexto_domiciliario.barreras_entorno?.length > 0 && <InfoCard label="Barreras Entorno" value={p15.contexto_domiciliario.barreras_entorno.map(humanize).join(', ')} />}
                                    </div>
                                )}

                                {/* BPS Flags */}
                                {p15_flags && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {p15_flags.factores_personales_positivos?.length > 0 && (
                                            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                                <h5 className="text-[9px] font-bold text-emerald-600 uppercase mb-1">Factores Positivos</h5>
                                                <div className="flex flex-wrap gap-1">{p15_flags.factores_personales_positivos.map((f: string, i: number) => <span key={i} className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{f}</span>)}</div>
                                            </div>
                                        )}
                                        {p15_flags.factores_personales_negativos?.length > 0 && (
                                            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                                                <h5 className="text-[9px] font-bold text-amber-600 uppercase mb-1">Factores Negativos / Barreras</h5>
                                                <div className="flex flex-wrap gap-1">{p15_flags.factores_personales_negativos.map((f: string, i: number) => <span key={i} className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{f}</span>)}</div>
                                            </div>
                                        )}
                                        {p15_flags.facilitadores_ambientales?.length > 0 && (
                                            <div className="bg-sky-50 p-3 rounded-xl border border-sky-100">
                                                <h5 className="text-[9px] font-bold text-sky-600 uppercase mb-1">Facilitadores</h5>
                                                <div className="flex flex-wrap gap-1">{p15_flags.facilitadores_ambientales.map((f: string, i: number) => <span key={i} className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{f}</span>)}</div>
                                            </div>
                                        )}
                                        {p15_flags.barreras_ambientales?.length > 0 && (
                                            <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                                                <h5 className="text-[9px] font-bold text-rose-600 uppercase mb-1">Barreras Ambientales</h5>
                                                <div className="flex flex-wrap gap-1">{p15_flags.barreras_ambientales.map((f: string, i: number) => <span key={i} className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{f}</span>)}</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Notas Permanentes */}
                                {ev.remoteHistorySnapshot?.permanentNotes && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Notas Permanentes del Perfil</h4>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ev.remoteHistorySnapshot.permanentNotes}</p>
                                    </div>
                                )}

                                {/* Modificadores clínicos */}
                                {p15.modificadores_clinicos?.length > 0 && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Modificadores Clínicos</h4>
                                        <div className="flex flex-wrap gap-1">{p15.modificadores_clinicos.map((m: string, i: number) => <span key={i} className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{m}</span>)}</div>
                                    </div>
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

                        {/* P2 Especializado: Renderizar datos clínicos de forma legible */}
                        {ev.guidedExam && Object.keys(ev.guidedExam).length > 0 && (() => {
                            const gx = ev.guidedExam as any;
                            const obsConfig = gx.observacionInicialConfig;
                            const romRows = gx.romRangeRows || gx.romAnaliticoConfig?.romRangeRows || [];
                            const muscleRows = gx.musclePerformanceRows || gx.fuerzaCargaConfig?.musclePerformanceRows || [];
                            const neuroRowsData = gx.neuroRows || gx.neuroVascularConfig?.neuroRows || [];
                            const retestCfg = gx.retestConfig;
                            const medidasCfg = gx.medidasComplementariasConfig;
                            const palpText = gx.palpationDetails || gx.palpation || gx.palpacionConfig?.palpationDetails || '';
                            const motorText = gx.motorControl || gx.controlMotorConfig?.motorControlText || '';
                            const ortopText = gx.specialTestsText || gx.orthopedicTestsText || gx.ortopedicasConfig?.specialTestsText || '';
                            const funcText = gx.functionalTestsText || gx.functionalTests || gx.funcionalesConfig?.functionalTestsText || '';
                            const obsText = gx.observation || '';
                            const hasP2Data = obsConfig || romRows.length > 0 || muscleRows.length > 0 || neuroRowsData.length > 0 || retestCfg || medidasCfg || palpText || motorText || ortopText || funcText || obsText;
                            if (!hasP2Data) return null;

                            return (
                                <div className="space-y-4 mb-5">
                                    {/* Observación Inicial */}
                                    {(obsConfig || obsText) && (
                                        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100/80 shadow-sm">
                                            <h4 className="text-[11px] font-black text-amber-700 uppercase mb-3 tracking-widest border-b border-amber-100 pb-2">Observación Inicial</h4>
                                            {obsText && <p className="text-sm text-slate-700 mb-3 leading-relaxed">{obsText}</p>}
                                            {gx.movimientoObservadoHoy && <p className="text-xs text-slate-600 mb-2"><span className="font-bold text-slate-500">Movimiento observado:</span> {gx.movimientoObservadoHoy}</p>}
                                            {gx.postureAlignment && <p className="text-xs text-slate-600 mb-2"><span className="font-bold text-slate-500">Alineación postural:</span> {gx.postureAlignment}</p>}
                                            {gx.gaitBasicGesture && <p className="text-xs text-slate-600 mb-2"><span className="font-bold text-slate-500">Marcha:</span> {gx.gaitBasicGesture}</p>}
                                            {obsConfig && (
                                                <div className="flex flex-wrap gap-4 mt-2">
                                                    {obsConfig.posturaChips?.length > 0 && (
                                                        <div>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Postura</span>
                                                            <div className="flex flex-wrap gap-1">{obsConfig.posturaChips.map((c: string, i: number) => <span key={i} className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{c}</span>)}</div>
                                                        </div>
                                                    )}
                                                    {obsConfig.marchaChips?.length > 0 && (
                                                        <div>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Marcha</span>
                                                            <div className="flex flex-wrap gap-1">{obsConfig.marchaChips.map((c: string, i: number) => <span key={i} className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{c}</span>)}</div>
                                                        </div>
                                                    )}
                                                    {obsConfig.movLibreChips?.length > 0 && (
                                                        <div>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Movimiento Libre</span>
                                                            <div className="flex flex-wrap gap-1">{obsConfig.movLibreChips.map((c: string, i: number) => <span key={i} className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{c}</span>)}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ROM Analítico - Tabla */}
                                    {romRows.length > 0 && (
                                        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100/80 shadow-sm overflow-x-auto">
                                            <h4 className="text-[11px] font-black text-amber-700 uppercase mb-3 tracking-widest border-b border-amber-100 pb-2">ROM Analítico</h4>
                                            <table className="w-full text-xs">
                                                <thead><tr className="border-b border-slate-200">
                                                    <th className="text-left py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Movimiento</th>
                                                    <th className="text-center py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Lado</th>
                                                    <th className="text-center py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Dolor</th>
                                                    <th className="text-center py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">End-Feel</th>
                                                    <th className="text-left py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Notas</th>
                                                </tr></thead>
                                                <tbody>{romRows.filter((r: any) => r.movement).map((r: any, i: number) => (
                                                    <tr key={i} className="border-b border-slate-100 hover:bg-white/60">
                                                        <td className="py-1.5 px-2 font-medium text-slate-700">{r.movement}</td>
                                                        <td className="py-1.5 px-2 text-center text-slate-600">{humanize(r.side) || '—'}</td>
                                                        <td className="py-1.5 px-2 text-center"><span className={`font-bold ${(r.painLevel || 0) >= 5 ? 'text-rose-600' : (r.painLevel || 0) >= 3 ? 'text-amber-600' : 'text-slate-500'}`}>{r.painLevel ?? '—'}</span></td>
                                                        <td className="py-1.5 px-2 text-center text-slate-600">{humanize(r.endFeel) || '—'}</td>
                                                        <td className="py-1.5 px-2 text-slate-500 italic">{r.notes || '—'}</td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Fuerza y Carga - Tabla */}
                                    {muscleRows.length > 0 && (
                                        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100/80 shadow-sm overflow-x-auto">
                                            <h4 className="text-[11px] font-black text-amber-700 uppercase mb-3 tracking-widest border-b border-amber-100 pb-2">Fuerza y Carga</h4>
                                            <table className="w-full text-xs">
                                                <thead><tr className="border-b border-slate-200">
                                                    <th className="text-left py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Acción Muscular</th>
                                                    <th className="text-center py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Lado</th>
                                                    <th className="text-center py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Grado MRC</th>
                                                    <th className="text-center py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Dolor</th>
                                                    <th className="text-left py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Notas</th>
                                                </tr></thead>
                                                <tbody>{muscleRows.filter((r: any) => r.action).map((r: any, i: number) => (
                                                    <tr key={i} className="border-b border-slate-100 hover:bg-white/60">
                                                        <td className="py-1.5 px-2 font-medium text-slate-700">{r.action}</td>
                                                        <td className="py-1.5 px-2 text-center text-slate-600">{humanize(r.side) || '—'}</td>
                                                        <td className="py-1.5 px-2 text-center font-bold text-slate-700">{humanize(r.mrcGrade) || '—'}</td>
                                                        <td className="py-1.5 px-2 text-center"><span className={`font-bold ${(r.painScale || 0) >= 5 ? 'text-rose-600' : (r.painScale || 0) >= 3 ? 'text-amber-600' : 'text-slate-500'}`}>{r.painScale ?? '—'}</span></td>
                                                        <td className="py-1.5 px-2 text-slate-500 italic">{r.notes || '—'}</td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Palpación */}
                                    {palpText && (
                                        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100/80 shadow-sm">
                                            <h4 className="text-[11px] font-black text-amber-700 uppercase mb-3 tracking-widest border-b border-amber-100 pb-2">Palpación</h4>
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{palpText}</p>
                                        </div>
                                    )}

                                    {/* Neurovascular */}
                                    {neuroRowsData.length > 0 && (
                                        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100/80 shadow-sm overflow-x-auto">
                                            <h4 className="text-[11px] font-black text-amber-700 uppercase mb-3 tracking-widest border-b border-amber-100 pb-2">Evaluación Neurovascular</h4>
                                            <table className="w-full text-xs">
                                                <thead><tr className="border-b border-slate-200">
                                                    <th className="text-left py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Test</th>
                                                    <th className="text-center py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Hallazgo</th>
                                                    <th className="text-left py-1.5 px-2 font-bold text-slate-500 uppercase text-[10px]">Notas</th>
                                                </tr></thead>
                                                <tbody>{neuroRowsData.filter((r: any) => r.test).map((r: any, i: number) => (
                                                    <tr key={i} className="border-b border-slate-100 hover:bg-white/60">
                                                        <td className="py-1.5 px-2 font-medium text-slate-700">{r.test}</td>
                                                        <td className="py-1.5 px-2 text-center"><span className={`font-bold ${r.finding === 'Positivo' || r.finding === 'positivo' ? 'text-rose-600' : 'text-slate-600'}`}>{humanize(r.finding)}</span></td>
                                                        <td className="py-1.5 px-2 text-slate-500 italic">{r.notes || '—'}</td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Control Motor */}
                                    {motorText && (
                                        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100/80 shadow-sm">
                                            <h4 className="text-[11px] font-black text-amber-700 uppercase mb-3 tracking-widest border-b border-amber-100 pb-2">Control Motor</h4>
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{motorText}</p>
                                        </div>
                                    )}

                                    {/* Pruebas Ortopédicas */}
                                    {ortopText && (
                                        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100/80 shadow-sm">
                                            <h4 className="text-[11px] font-black text-amber-700 uppercase mb-3 tracking-widest border-b border-amber-100 pb-2">Pruebas Ortopédicas Especiales</h4>
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ortopText}</p>
                                        </div>
                                    )}

                                    {/* Pruebas Funcionales */}
                                    {funcText && (
                                        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100/80 shadow-sm">
                                            <h4 className="text-[11px] font-black text-amber-700 uppercase mb-3 tracking-widest border-b border-amber-100 pb-2">Pruebas Funcionales</h4>
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{funcText}</p>
                                        </div>
                                    )}

                                    {/* Retest / Confirmación */}
                                    {retestCfg && (retestCfg.tareaIndice || retestCfg.resultadoPost || retestCfg.comentario) && (
                                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
                                            <h4 className="text-[11px] font-black text-amber-700 uppercase mb-3 tracking-widest border-b border-amber-200 pb-2">Retest / Confirmación</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                {retestCfg.tareaIndice && <div><span className="text-[9px] font-bold text-amber-600 uppercase block mb-0.5">Tarea Índice</span><span className="text-sm font-medium text-slate-800">{retestCfg.tareaIndice}</span></div>}
                                                {retestCfg.resultadoPost && <div><span className="text-[9px] font-bold text-amber-600 uppercase block mb-0.5">Resultado Post</span><span className="text-sm font-bold text-slate-800">{humanize(retestCfg.resultadoPost)}</span></div>}
                                                {retestCfg.intervencion && <div><span className="text-[9px] font-bold text-amber-600 uppercase block mb-0.5">Intervención</span><span className="text-sm font-medium text-slate-800">{retestCfg.intervencion}</span></div>}
                                            </div>
                                            {retestCfg.comentario && <p className="text-xs text-slate-600 mt-3 leading-relaxed italic">{retestCfg.comentario}</p>}
                                        </div>
                                    )}

                                    {/* Medidas Complementarias */}
                                    {medidasCfg && (medidasCfg.peso || medidasCfg.talla || medidasCfg.imc || medidasCfg.perimetroEdema || medidasCfg.pa) && (
                                        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100/80 shadow-sm">
                                            <h4 className="text-[11px] font-black text-amber-700 uppercase mb-3 tracking-widest border-b border-amber-100 pb-2">Medidas Complementarias</h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                {medidasCfg.peso && <InfoCard label="Peso" value={medidasCfg.peso} />}
                                                {medidasCfg.talla && <InfoCard label="Talla" value={medidasCfg.talla} />}
                                                {medidasCfg.imc && <InfoCard label="IMC" value={medidasCfg.imc} />}
                                                {medidasCfg.perimetroEdema && <InfoCard label="Perímetro / Edema" value={medidasCfg.perimetroEdema} />}
                                                {medidasCfg.pa && <InfoCard label="Presión Arterial" value={medidasCfg.pa} />}
                                                {medidasCfg.fc && <InfoCard label="Frecuencia Cardíaca" value={medidasCfg.fc} />}
                                                {medidasCfg.satO2 && <InfoCard label="Saturación O₂" value={medidasCfg.satO2} />}
                                                {medidasCfg.otraMedida && <InfoCard label="Otra Medida" value={medidasCfg.otraMedida} />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {p2_text ? (
                            <div className="p-5 rounded-xl border border-slate-100 bg-amber-50/30">
                                <h4 className="text-[11px] font-black text-amber-700 uppercase mb-2 tracking-widest">Síntesis del Examen Físico</h4>
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
                                    <div className="text-lg font-bold text-teal-900">
                                        {p3.clasificacion_dolor.categoria || p3.clasificacion_dolor.categoria_seleccionada}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {(p3.clasificacion_dolor.subtipos || p3.clasificacion_dolor.subtipos_seleccionados || (p3.clasificacion_dolor.subtipo_seleccionado ? [p3.clasificacion_dolor.subtipo_seleccionado] : [])).map((s: string, idx: number) => (
                                            <span key={idx} className="bg-teal-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                {s}
                                            </span>
                                        ))}
                                        {p3.clasificacion_dolor.subtipo_manual && (
                                            <span className="bg-white border border-teal-200 text-teal-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shadow-sm italic">
                                                {p3.clasificacion_dolor.subtipo_manual}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-teal-800/80 mt-3 font-medium leading-relaxed">
                                        {p3.clasificacion_dolor.fundamento?.conclusion || p3.clasificacion_dolor.fundamento_breve}
                                    </p>
                                </div>

                                {/* Sistema y Estructuras */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                          <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Sistema y Estructuras</h4>
                                          <p className="text-base text-slate-800 font-bold">
                                            {(p3.sistema_y_estructuras?.sistemas_involucrados || p3.sistema_y_estructuras?.sistemas_principales || []).join(', ')}
                                          </p>
                                          <p className="text-sm text-slate-700 font-medium">
                                            {(p3.sistema_y_estructuras?.estructuras?.principales || p3.sistema_y_estructuras?.estructuras_principales || [])
                                                .map((e: any) => typeof e === 'string' ? e : e.nombre)
                                                .join(', ')}
                                          </p>
                                          {(p3.sistema_y_estructuras?.estructuras?.secundarias || p3.sistema_y_estructuras?.estructuras_secundarias)?.length > 0 && (
                                            <p className="text-xs text-slate-500 mt-2">
                                                <span className="font-semibold">Secundarias:</span> {(p3.sistema_y_estructuras.estructuras?.secundarias || p3.sistema_y_estructuras.estructuras_secundarias).map((e: any) => typeof e === 'string' ? e : e.nombre).join(', ')}
                                            </p>
                                          )}
                                     </div>
                                     
                                     {/* Alteraciones Funcionales */}
                                     {p3.alteraciones_detectadas?.funcionales?.length > 0 && (
                                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                              <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Alteraciones Funcionales</h4>
                                              <div className="space-y-2">{p3.alteraciones_detectadas.funcionales.map((f:any, i:number) => (
                                                  <div key={`f-${i}`} className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-start justify-between gap-2">
                                                      <div><span className="text-sm font-bold text-slate-800">{f.funcion_disfuncion}</span>{f.dominio_sugerido && <span className="text-[10px] text-slate-500 ml-2">({humanize(f.dominio_sugerido)})</span>}{f.fundamento && <p className="text-xs text-slate-500 mt-0.5 italic">{f.fundamento}</p>}</div>
                                                      {f.severidad && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${f.severidad === 'Severa' || f.severidad === 'Completa' ? 'bg-rose-100 text-rose-700' : f.severidad === 'Moderada' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{humanize(f.severidad)}</span>}
                                                  </div>
                                              ))}</div>
                                         </div>
                                     )}

                                     {/* Alteraciones Estructurales */}
                                     {p3.alteraciones_detectadas?.estructurales?.length > 0 && (
                                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                              <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Alteraciones Estructurales</h4>
                                              <div className="space-y-2">{p3.alteraciones_detectadas.estructurales.map((e:any, i:number) => (
                                                  <div key={`e-${i}`} className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-start justify-between gap-2">
                                                      <div><span className="text-sm font-bold text-slate-800">{e.alteracion}</span> <span className="text-sm text-slate-600">({e.estructura})</span>{e.impacto_caso && <span className="text-[10px] text-slate-500 ml-2">Impacto: {humanize(e.impacto_caso)}</span>}{e.fundamento && <p className="text-xs text-slate-500 mt-0.5 italic">{e.fundamento}</p>}</div>
                                                      {e.certeza && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${e.certeza === 'Casi confirmada' ? 'bg-emerald-100 text-emerald-700' : e.certeza === 'Probable' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>{humanize(e.certeza)}</span>}
                                                  </div>
                                              ))}</div>
                                         </div>
                                     )}

                                     {/* F1 - Actividad / P1 - Participación */}
                                     {p3.actividad_y_participacion?.limitaciones_directas?.length > 0 && (
                                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                              <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Limitaciones (F1)</h4>
                                              <ul className="text-sm text-slate-700 list-disc pl-4 space-y-1.5">
                                                  {p3.actividad_y_participacion.limitaciones_directas.map((l:any, i:number) => (
                                                    <li key={`l-${i}`}>
                                                        {l.texto || l.actividad} <span className="text-[10px] font-bold text-slate-400">({l.severidad})</span>
                                                    </li>
                                                  ))}
                                              </ul>
                                         </div>
                                     )}

                                     {p3.actividad_y_participacion?.restricciones_sociales?.length > 0 && (
                                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                              <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Restricciones (F2)</h4>
                                              <ul className="text-sm text-slate-700 list-disc pl-4 space-y-1.5">
                                                  {p3.actividad_y_participacion.restricciones_sociales.map((r:any, i:number) => (
                                                    <li key={`r-${i}`}>
                                                        {r.texto || r.participacion} <span className="text-[10px] font-bold text-slate-400">({r.severidad})</span>
                                                    </li>
                                                  ))}
                                              </ul>
                                         </div>
                                     )}

                                     {/* G - Factores Biopsicosociales */}
                                     {p3.factores_biopsicosociales && Object.keys(p3.factores_biopsicosociales).length > 0 && (
                                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 md:col-span-2">
                                              <h4 className="text-[11px] uppercase text-slate-500 font-bold mb-3 tracking-wider border-b pb-1">Factores Biopsicosociales (G)</h4>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                  {Object.entries(p3.factores_biopsicosociales).map(([key, list]: [string, any]) => (
                                                      Array.isArray(list) && list.length > 0 && (
                                                          <div key={key}>
                                                              <h5 className="text-[9px] uppercase font-black text-indigo-400 mb-1">{humanizeKey(key)}</h5>
                                                              <ul className="text-[11px] text-slate-600 list-disc pl-3 space-y-0.5">
                                                                  {list.map((item: any, idx: number) => (
                                                                      <li key={idx}>{item.texto || item.factor || item}</li>
                                                                  ))}
                                                              </ul>
                                                          </div>
                                                      )
                                                  ))}
                                              </div>
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
                                        {Array.isArray(p4.plan_maestro) ? (
                                            <div className="space-y-3">
                                                {p4.plan_maestro.map((fase: any, idx: number) => (
                                                    <div key={idx} className="border-l-2 border-slate-200 pl-3 py-1">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase">{fase.nombre_fase || `Fase ${idx+1}`}</div>
                                                        <div className="text-xs text-slate-700 font-bold">{fase.objetivo_fisiologico}</div>
                                                        <ul className="mt-1 text-[10px] text-slate-500 list-disc pl-3">
                                                            {(fase.intervenciones || []).slice(0,2).map((inter: any, i: number) => (
                                                                <li key={i}>{typeof inter === 'string' ? inter : inter.nombre}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{p4.plan_maestro}</p>
                                        )}
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

                    {ev.reevaluation?.retest && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="text-sm uppercase tracking-widest font-bold text-emerald-600 mb-5 flex items-center gap-2 border-b pb-3">Retest Clínico</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {Object.entries(ev.reevaluation.retest).map(([key, val]: [string, any]) => {
                                    if (!val || key === 'status') return null;
                                    const title = key.replace(/([A-Z])/g, ' $1').replace(/Config/ig, '').trim().toUpperCase();
                                    return (
                                        <div key={key} className="bg-slate-50/80 p-4 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                            <h4 className="text-[11px] font-black text-emerald-700 uppercase mb-3 tracking-widest border-b border-emerald-100 pb-2">{title}</h4>
                                            <div className="w-full overflow-x-auto">
                                                <StructuredDataRenderer data={val} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-sm uppercase tracking-widest font-bold text-emerald-600 mb-5 flex items-center gap-2 border-b pb-3">Ajustes Módulos y Plan</h3>
                        <p className="text-base text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{ev.reevaluation?.planModifications || "Sin ajustes al plan maestro."}</p>
                        
                        {(ev.reevaluation as any)?.updatedObjectives && (ev.reevaluation as any).updatedObjectives.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado de Objetivos Actualizado</h4>
                                {(ev.reevaluation as any).updatedObjectives.map((obj: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded border border-slate-100">
                                        <span className={`w-2 h-2 rounded-full ${obj.status === 'completado' ? 'bg-emerald-500' : obj.status === 'pausado' ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
                                        <span className="font-bold flex-1">{obj.texto || obj.label}</span>
                                        <span className="uppercase font-black text-[9px] text-slate-400">{obj.status}</span>
                                    </div>
                                ))}
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
