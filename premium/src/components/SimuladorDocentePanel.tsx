"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getIntentosDocente, eliminarIntento } from '@/services/simuladorFirebase';
import type { SimuladorIntento } from '@/services/simuladorFirebase';

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

    useEffect(() => {
        if (user?.role !== 'DOCENTE') return;
        getIntentosDocente(200)
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
                <p className="text-amber-100 text-sm">Historial de intentos de todos los estudiantes</p>
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
                                const fecha = int.fecha?.toDate ? int.fecha.toDate() : new Date();
                                const isExpanded = expandedId === int.id;
                                return (
                                    <>
                                        <tr key={int.id} className={`hover:bg-slate-50 cursor-pointer transition ${isExpanded ? 'bg-amber-50/50' : ''}`}
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
                                        {isExpanded && int.scorecard && (
                                            <tr key={`${int.id}-detail`}>
                                                <td colSpan={8} className="px-4 py-3 bg-amber-50/30">
                                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                                        {Object.entries(int.scorecard).map(([k, v]) => (
                                                            <div key={k} className="bg-white rounded-lg p-2 border border-slate-200 text-center">
                                                                <div className="text-[9px] text-slate-500 font-semibold truncate">{SCORECARD_LABELS[k] || k}</div>
                                                                <div className={`text-lg font-black ${(v as any).puntaje >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                    {(v as any).puntaje}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
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
