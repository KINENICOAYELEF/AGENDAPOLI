"use client";

import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getVoiceDefenses, deleteVoiceDefense, exportarDefensaVozPDF } from '@/services/simuladorFirebase';
import type { DefensaVozIntento } from '@/services/simuladorFirebase';

function formatTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

export function DefensaDocentePanel() {
    const { user } = useAuth();
    const [intentos, setIntentos] = useState<DefensaVozIntento[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filterStudent, setFilterStudent] = useState('');

    useEffect(() => {
        if (user?.role !== 'DOCENTE') return;
        getVoiceDefenses()
            .then(setIntentos)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [user?.role]);

    if (user?.role !== 'DOCENTE') return null;

    const uniqueStudents = [...new Set(intentos.map(i => i.userName))].sort();

    const filtered = filterStudent
        ? intentos.filter(i => i.userName === filterStudent)
        : intentos;

    // Stats
    const avgNota = filtered.length ? (filtered.reduce((s, i) => s + (i.notaChilena || 0), 0) / filtered.length) : 0;
    const aprobados = filtered.filter(i => (i.notaChilena || 0) >= 4.0).length;
    const totalStudents = new Set(filtered.map(i => i.userId)).size;

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este intento de defensa de voz permanentemente?')) return;
        try {
            await deleteVoiceDefense(id);
            setIntentos(prev => prev.filter(i => i.id !== id));
        } catch (e) {
            alert('Error al eliminar el intento.');
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-6">
            <div className="bg-gradient-to-r from-rose-600 to-red-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white">🎤 Panel de Defensas de Comisión (Voz)</h3>
                <p className="text-rose-100 text-sm">Historial de intentos y transcripciones de las evaluaciones orales</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200">
                <div className="text-center">
                    <div className="text-2xl font-black text-slate-800">{filtered.length}</div>
                    <div className="text-[10px] text-slate-500 font-semibold">INTENTOS</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-black text-slate-800">{totalStudents}</div>
                    <div className="text-[10px] text-slate-500 font-semibold">ESTUDIANTES</div>
                </div>
                <div className="text-center">
                    <div className={`text-2xl font-black ${avgNota >= 4.0 ? 'text-emerald-600' : 'text-red-600'}`}>{avgNota.toFixed(1)}</div>
                    <div className="text-[10px] text-slate-500 font-semibold">NOTA PROMEDIO</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-black text-blue-600">{filtered.length ? Math.round(aprobados / filtered.length * 100) : 0}%</div>
                    <div className="text-[10px] text-slate-500 font-semibold">APROBACIÓN</div>
                </div>
            </div>

            {/* Filter */}
            <div className="p-4 border-b border-slate-200">
                <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-200 outline-none">
                    <option value="">Todos los estudiantes ({uniqueStudents.length})</option>
                    {uniqueStudents.map(s => {
                        const count = intentos.filter(i => i.userName === s).length;
                        return <option key={s} value={s}>{s} ({count} intentos)</option>;
                    })}
                </select>
            </div>

            {/* Loading */}
            {loading && <p className="text-sm text-slate-400 p-6 text-center">Cargando intentos de defensas de voz...</p>}

            {/* Table */}
            {!loading && intentos.length === 0 && (
                <p className="text-sm text-slate-400 p-6 text-center">No hay intentos de defensa de voz registrados.</p>
            )}

            {!loading && filtered.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b">
                                <th className="px-4 py-3">Estudiante</th>
                                <th className="px-4 py-3">Caso Paciente</th>
                                <th className="px-4 py-3">Nota</th>
                                <th className="px-4 py-3">Área / Dificultad</th>
                                <th className="px-4 py-3">Tiempo</th>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(int => {
                                const fecha = (int.fecha && typeof int.fecha.toDate === 'function') ? int.fecha.toDate() : new Date();
                                const isExpanded = expandedId === int.id;
                                return (
                                    <Fragment key={int.id}>
                                        <tr className={`hover:bg-slate-50 cursor-pointer transition ${isExpanded ? 'bg-rose-50/30 border-b-0' : ''}`}
                                            onClick={() => setExpandedId(isExpanded ? null : (int.id || null))}>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-800">{int.userName || 'Anónimo'}</div>
                                                <div className="text-[10px] text-slate-400">{int.userEmail}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-700">{int.pacienteNombre || '—'}</div>
                                                <div className="text-[10px] text-slate-400 truncate max-w-xs">{int.motivoConsulta || '—'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`font-black text-lg ${(int.notaChilena || 0) >= 4.0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {int.notaChilena?.toFixed(1) || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 font-medium">
                                                <span className="capitalize">{int.area || 'Aleatoria'}</span>
                                                <span className="text-[10px] text-slate-400 block capitalize">{int.dificultad || 'Avanzado'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 font-mono">{formatTime(int.tiempoSegundos || 0)}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">{fecha.toLocaleDateString('es-CL')}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(int.id!); }}
                                                    className="text-xs text-red-400 hover:text-red-600 font-bold p-1">🗑</button>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-50/40">
                                                <td colSpan={7} className="px-6 py-4 border-b border-slate-200">
                                                    <div className="space-y-6 max-w-4xl">
                                                        <div className="flex justify-between items-center border-b pb-2">
                                                            <h4 className="font-bold text-sm text-slate-700 uppercase tracking-wider">Detalles de la Defensa de Voz</h4>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); exportarDefensaVozPDF(int); }}
                                                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                                            >
                                                                📄 Exportar Reporte (PDF)
                                                            </button>
                                                        </div>

                                                        {/* Caso Clínico Completo si está disponible */}
                                                        {int.casoClinico && (
                                                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs space-y-2">
                                                                <h5 className="font-bold text-blue-900 text-sm">Ficha Clínica Detallada (Caso Clínico)</h5>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <p><strong>Paciente:</strong> {int.casoClinico.fichaVisible?.nombre || int.pacienteNombre} ({int.casoClinico.fichaVisible?.edad || 'N/A'})</p>
                                                                        <p><strong>Ocupación/Deporte:</strong> {int.casoClinico.fichaVisible?.ocupacion || 'N/A'} / {int.casoClinico.fichaVisible?.deporte_actividad || 'N/A'}</p>
                                                                        <p><strong>Motivo de Consulta:</strong> {int.casoClinico.fichaVisible?.motivo_consulta || int.motivoConsulta}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="leading-relaxed text-slate-700">
                                                                            <strong>Anamnesis Próxima:</strong> {int.casoClinico.perfilSecreto?.historia_completa || 'N/A'}<br />
                                                                            <strong>Anamnesis Remota:</strong> {int.casoClinico.perfilSecreto?.antecedentes_relevantes?.join(', ') || 'Ninguno'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                {int.casoClinico.hallazgos && Object.keys(int.casoClinico.hallazgos).length > 0 && (
                                                                    <div className="border-t border-blue-200 pt-2 mt-2">
                                                                        <strong className="text-blue-800 block mb-1">Hallazgos del Examen Físico:</strong>
                                                                        <ul className="list-disc list-inside text-blue-950 space-y-0.5">
                                                                            {Object.entries(int.casoClinico.hallazgos).map(([k, v]) => (
                                                                                v && v !== 'Normal' ? <li key={k}><strong>{k.replace(/_/g, ' ')}:</strong> {v as string}</li> : null
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Propuesta Escrita (Construcción) */}
                                                        <div>
                                                            <h5 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-2">Propuesta Escrita (Planificación)</h5>
                                                            <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-3 border border-slate-100">
                                                                {int.construccion?.problema_principal && (
                                                                    <div>
                                                                        <span className="font-bold text-rose-700 block">Problema Principal:</span>
                                                                        <p className="text-slate-700 whitespace-pre-wrap">{int.construccion.problema_principal}</p>
                                                                    </div>
                                                                )}
                                                                {int.construccion?.diagnostico && (
                                                                    <div>
                                                                        <span className="font-bold text-indigo-700 block">Diagnóstico:</span>
                                                                        <p className="text-slate-700 whitespace-pre-wrap">{int.construccion.diagnostico}</p>
                                                                    </div>
                                                                )}
                                                                {int.construccion?.objetivo_general && (
                                                                    <div>
                                                                        <span className="font-bold text-indigo-700 block">Objetivo General:</span>
                                                                        <p className="text-slate-700 whitespace-pre-wrap">{int.construccion.objetivo_general}</p>
                                                                    </div>
                                                                )}
                                                                {int.construccion?.objetivos_especificos && (
                                                                    <div>
                                                                        <span className="font-bold text-indigo-700 block">Objetivos Específicos:</span>
                                                                        <p className="text-slate-700 whitespace-pre-wrap">{int.construccion.objetivos_especificos}</p>
                                                                    </div>
                                                                )}
                                                                {int.construccion?.objetivos_operacionales && (
                                                                    <div>
                                                                        <span className="font-bold text-indigo-700 block">Objetivos Operacionales:</span>
                                                                        <p className="text-slate-700 whitespace-pre-wrap">{int.construccion.objetivos_operacionales}</p>
                                                                    </div>
                                                                )}
                                                                {int.construccion?.plan_fases && (
                                                                    <div>
                                                                        <span className="font-bold text-indigo-700 block">Plan de Fases:</span>
                                                                        <p className="text-slate-700 whitespace-pre-wrap">{int.construccion.plan_fases}</p>
                                                                    </div>
                                                                )}
                                                                {int.construccion?.reevaluacion && (
                                                                    <div>
                                                                        <span className="font-bold text-indigo-700 block">Reevaluación:</span>
                                                                        <p className="text-slate-700 whitespace-pre-wrap">{int.construccion.reevaluacion}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Rúbrica y Notas */}
                                                        <div>
                                                            <h5 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-2">Evaluación y Rúbrica de la Comisión</h5>
                                                            <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl mb-4 text-xs">
                                                                <p className="font-bold text-indigo-900 text-sm mb-1">Feedback Final de la Comisión:</p>
                                                                <p className="text-indigo-950 whitespace-pre-wrap">{int.feedbackFinal}</p>
                                                            </div>

                                                            {int.rubricaDetallada && Object.keys(int.rubricaDetallada).length > 0 && (
                                                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                                    <table className="w-full text-left text-xs">
                                                                        <thead>
                                                                            <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider font-semibold border-b">
                                                                                <th className="px-3 py-2">Competencia</th>
                                                                                <th className="px-3 py-2 w-20 text-center">Puntaje</th>
                                                                                <th className="px-3 py-2">Feedback de la Comisión</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100">
                                                                            {Object.entries(int.rubricaDetallada).map(([key, sc]: [string, any]) => (
                                                                                <tr key={key} className="hover:bg-slate-50/30">
                                                                                    <td className="px-3 py-2 font-semibold text-slate-700 capitalize">{key.replace(/_/g, ' ')}</td>
                                                                                    <td className="px-3 py-2 text-center font-bold">
                                                                                        <span className={`px-1.5 py-0.5 rounded ${sc.puntaje >= 60 ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                                                                                            {sc.puntaje}/100
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-3 py-2 text-slate-600 italic">{sc.comentario || '—'}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Aciertos, Errores y Recomendaciones */}
                                                        <div className="grid md:grid-cols-2 gap-4 text-xs">
                                                            {int.aciertos && int.aciertos.length > 0 && (
                                                                <div className="bg-emerald-50/50 p-4 border border-emerald-200 rounded-xl">
                                                                    <h6 className="font-bold text-emerald-800 mb-2">✅ Aciertos Destacados</h6>
                                                                    <ul className="list-disc pl-4 text-slate-700 space-y-1">
                                                                        {int.aciertos.map((a, i) => <li key={i}>{a}</li>)}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {int.errores && int.errores.length > 0 && (
                                                                <div className="bg-red-50/50 p-4 border border-red-200 rounded-xl">
                                                                    <h6 className="font-bold text-red-800 mb-2">❌ Errores Críticos</h6>
                                                                    <ul className="list-disc pl-4 text-slate-700 space-y-1">
                                                                        {int.errores.map((e, i) => <li key={i}>{e}</li>)}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {int.temasAEstudiar && int.temasAEstudiar.length > 0 && (
                                                            <div className="bg-blue-50/50 border border-blue-200 p-4 rounded-xl text-xs">
                                                                <h6 className="font-bold text-blue-900 mb-2">📚 Temas Recomendados para Repasar</h6>
                                                                <ul className="list-disc pl-4 text-blue-950 space-y-1">
                                                                    {int.temasAEstudiar.map((t, i) => <li key={i}>{t}</li>)}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Transcripción de la defensa */}
                                                        {int.transcripcion && (
                                                            <div>
                                                                <h5 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-2">🎤 Transcripción Completa del Examen Oral</h5>
                                                                <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap leading-relaxed">
                                                                    {int.transcripcion}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
