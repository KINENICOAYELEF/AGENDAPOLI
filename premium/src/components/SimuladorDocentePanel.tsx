"use client";

import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getIntentosDocente, eliminarIntento, getTareaConfig, guardarTareaConfig } from '@/services/simuladorFirebase';
import type { SimuladorIntento, SimuladorTareaConfig } from '@/services/simuladorFirebase';

const SCORECARD_LABELS: Record<string, string> = {
    entrevista: 'Entrevista',
    razonamiento_previo: 'Razonamiento I',
    razonamiento_integrador: 'Razonamiento II',
    examen_fisico: 'Examen Físico',
    intervencion_paciente: 'Intervención',
    diagnostico: 'Diagnóstico',
    objetivos: 'Objetivos',
    plan_fases: 'Plan Fases',
    reevaluacion: 'Reevaluación',
    intervencion: 'Intervención (legado)',
};

function formatTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

export function SimuladorDocentePanel() {
    const { user } = useAuth();
    const [intentos, setIntentos] = useState<SimuladorIntento[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filterStudent, setFilterStudent] = useState('');

    // Task config state
    const [tareaConfig, setTareaConfig] = useState<SimuladorTareaConfig>({
        activa: false,
        frecuenciaDias: 3,
        modoMinimo: 'cualquiera',
        mensaje: '',
    });
    const [savingConfig, setSavingConfig] = useState(false);
    const [configSaved, setConfigSaved] = useState(false);

    useEffect(() => {
        if (user?.role !== 'DOCENTE') return;
        getIntentosDocente(200)
            .then(setIntentos)
            .catch(console.error)
            .finally(() => setLoading(false));
        getTareaConfig()
            .then(cfg => { if (cfg) setTareaConfig(cfg); })
            .catch(console.error);
    }, [user?.role]);

    if (user?.role !== 'DOCENTE') return null;

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        setConfigSaved(false);
        try {
            await guardarTareaConfig({ ...tareaConfig, actualizadoPor: user.email || '' });
            setConfigSaved(true);
            setTimeout(() => setConfigSaved(false), 3000);
        } catch (e) { alert('Error al guardar configuración'); }
        finally { setSavingConfig(false); }
    };

    const uniqueStudents = [...new Set(intentos.map(i => i.userName))].sort();

    const filtered = filterStudent
        ? intentos.filter(i => i.userName === filterStudent)
        : intentos;

    // Stats
    const avgNota = filtered.length ? (filtered.reduce((s, i) => s + (i.notaChilena || 0), 0) / filtered.length) : 0;
    const aprobados = filtered.filter(i => (i.notaChilena || 0) >= 4.0).length;
    const totalStudents = new Set(filtered.map(i => i.userId)).size;

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este intento permanentemente?')) return;
        try {
            await eliminarIntento(id);
            setIntentos(prev => prev.filter(i => i.id !== id));
        } catch (e) { alert('Error al eliminar'); }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white">🎓 Panel del Simulador de Examen</h3>
                <p className="text-amber-100 text-sm">Configuración de tareas e historial de intentos</p>
            </div>

            {/* ═══ TASK CONFIG ═══ */}
            <div className="p-4 border-b border-slate-200 bg-amber-50/30 space-y-3">
                <div className="flex items-center gap-3">
                    <h4 className="font-bold text-sm text-slate-800">📋 Tarea de Simulación</h4>
                    <button
                        onClick={() => setTareaConfig(prev => ({ ...prev, activa: !prev.activa }))}
                        className={`relative w-11 h-6 rounded-full transition-colors ${tareaConfig.activa ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${tareaConfig.activa ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                    <span className={`text-xs font-bold ${tareaConfig.activa ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {tareaConfig.activa ? 'ACTIVA' : 'DESACTIVADA'}
                    </span>
                </div>

                {tareaConfig.activa && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Frecuencia mínima</label>
                            <select
                                value={tareaConfig.frecuenciaDias}
                                onChange={e => setTareaConfig(prev => ({ ...prev, frecuenciaDias: Number(e.target.value) }))}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                            >
                                <option value={2}>Cada 2 días</option>
                                <option value={3}>Cada 3 días</option>
                                <option value={5}>Cada 5 días</option>
                                <option value={7}>Cada 7 días (semanal)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Modo mínimo aceptado</label>
                            <select
                                value={tareaConfig.modoMinimo}
                                onChange={e => setTareaConfig(prev => ({ ...prev, modoMinimo: e.target.value }))}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                            >
                                <option value="cualquiera">Cualquier modo</option>
                                <option value="completo">Solo Examen Completo</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Mensaje (opcional)</label>
                            <input
                                value={tareaConfig.mensaje || ''}
                                onChange={e => setTareaConfig(prev => ({ ...prev, mensaje: e.target.value }))}
                                placeholder="Ej: Deben practicar para la prueba del viernes"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSaveConfig}
                        disabled={savingConfig}
                        className="px-5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50"
                    >
                        {savingConfig ? 'Guardando...' : '💾 Guardar Configuración'}
                    </button>
                    {configSaved && <span className="text-xs text-emerald-600 font-bold">✓ Guardado</span>}
                </div>
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
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none">
                    <option value="">Todos los estudiantes ({uniqueStudents.length})</option>
                    {uniqueStudents.map(s => {
                        const count = intentos.filter(i => i.userName === s).length;
                        return <option key={s} value={s}>{s} ({count} intentos)</option>;
                    })}
                </select>
            </div>

            {/* Loading */}
            {loading && <p className="text-sm text-slate-400 p-6 text-center">Cargando intentos...</p>}

            {/* Table */}
            {!loading && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b">
                                <th className="px-4 py-3">Estudiante</th>
                                <th className="px-4 py-3">Caso</th>
                                <th className="px-4 py-3">Nota</th>
                                <th className="px-4 py-3">Nivel</th>
                                <th className="px-4 py-3">Comisión</th>
                                <th className="px-4 py-3">Tiempo</th>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(int => {
                                const fecha = int.fecha ? int.fecha.toDate() : new Date();
                                const isExpanded = expandedId === int.id;
                                return (
                                    <Fragment key={int.id}>
                                        <tr className={`hover:bg-slate-50 cursor-pointer transition ${isExpanded ? 'bg-amber-50/50 border-b-0' : ''}`}
                                            onClick={() => setExpandedId(isExpanded ? null : (int.id || null))}>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-800">{int.userName || 'Anónimo'}</div>
                                                <div className="text-[10px] text-slate-400">{int.userEmail}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-slate-700">{int.pacienteNombre || '—'}</div>
                                                <div className="text-[10px] text-slate-400">{int.area || 'aleatoria'} · {int.dificultad || 'intermedio'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`font-black text-lg ${(int.notaChilena || 0) >= 4.0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {int.notaChilena?.toFixed(1) || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                    int.nivel?.includes('Distinción') ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                                                    int.nivel === 'Aprobado' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                                                    int.nivel?.includes('Recuperable') ? 'text-amber-700 bg-amber-50 border-amber-200' :
                                                    'text-red-700 bg-red-50 border-red-200'
                                                }`}>{int.nivel || '—'}</span>
                                            </td>
                                            <td className="px-4 py-3 font-bold">{int.notaComision?.toFixed(1) || '—'}</td>
                                            <td className="px-4 py-3 text-slate-500">{formatTime(int.tiempoSegundos || 0)}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">{fecha.toLocaleDateString('es-CL')}</td>
                                            <td className="px-4 py-3">
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(int.id!); }}
                                                    className="text-xs text-red-400 hover:text-red-600 font-bold">🗑</button>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-50/50">
                                                <td colSpan={8} className="px-6 py-4 border-b border-slate-200">
                                                    <div className="space-y-4 max-w-4xl">
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                                            <div>
                                                                <span className="font-semibold text-slate-500 block">Modo de Práctica:</span>
                                                                <span className="font-bold text-slate-700 capitalize">{int.practiceMode || 'completo'}</span>
                                                            </div>
                                                            <div className="col-span-3">
                                                                <span className="font-semibold text-slate-500 block">Motivo de Consulta:</span>
                                                                <span className="text-slate-700">{int.motivoConsulta || '—'}</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h5 className="font-bold text-xs text-slate-600 mb-2 uppercase tracking-wider">Detalle de Calificación (Scorecard)</h5>
                                                            {int.scorecard && Object.keys(int.scorecard).length > 0 ? (
                                                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                                    <table className="w-full text-left text-xs">
                                                                        <thead>
                                                                            <tr className="bg-slate-100/80 text-slate-500 uppercase tracking-wider font-semibold border-b">
                                                                                <th className="px-3 py-2">Competencia</th>
                                                                                <th className="px-3 py-2 w-20 text-center">Puntaje</th>
                                                                                <th className="px-3 py-2">Retroalimentación / Comentario</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100">
                                                                            {Object.entries(int.scorecard).map(([key, sc]) => (
                                                                                <tr key={key} className="hover:bg-slate-50/30">
                                                                                    <td className="px-3 py-2 font-semibold text-slate-700">{SCORECARD_LABELS[key] || key.replace(/_/g, ' ')}</td>
                                                                                    <td className="px-3 py-2 text-center font-bold">
                                                                                        <span className={`px-1.5 py-0.5 rounded ${sc.puntaje >= 60 ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                                                                                            {sc.puntaje}/100
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-3 py-2 text-slate-600 italic">{sc.comentario || 'Sin comentario.'}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            ) : (
                                                                <p className="text-slate-400 italic text-xs">No hay desglose de scorecard para este intento.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                    {filtered.length === 0 && <p className="text-sm text-slate-400 p-6 text-center">Sin intentos registrados.</p>}
                </div>
            )}
        </div>
    );
}
