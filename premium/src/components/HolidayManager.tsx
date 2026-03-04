"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, writeBatch, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { Feriado } from "@/types/clinica";

export function HolidayManager() {
    const { globalActiveYear } = useYear();
    const [holidays, setHolidays] = useState<Feriado[]>([]);
    const [loading, setLoading] = useState(false);

    const [newDate, setNewDate] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newType, setNewType] = useState<'NACIONAL' | 'INSTITUCIONAL'>('INSTITUCIONAL');

    useEffect(() => {
        if (globalActiveYear) loadHolidays();
    }, [globalActiveYear]);

    const loadHolidays = async () => {
        if (!globalActiveYear) return;
        setLoading(true);
        try {
            const q = query(collection(db, "programs", globalActiveYear, "calendario_feriados"));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Feriado));
            data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setHolidays(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newDate || !newDesc) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            const ref = doc(db, "programs", globalActiveYear, "calendario_feriados", newDate);
            batch.set(ref, {
                date: newDate,
                description: newDesc,
                type: newType,
                active: true
            });
            await batch.commit();
            setNewDate("");
            setNewDesc("");
            await loadHolidays();
        } catch (error) {
            console.error(error);
            alert("Error al guardar bloqueo");
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (id: string) => {
        if (!confirm("¿Eliminar este bloqueo del calendario?")) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, "programs", globalActiveYear, "calendario_feriados", id));
            await loadHolidays();
        } catch (error) {
            console.error(error);
            alert("Error al eliminar bloqueo");
        } finally {
            setLoading(false);
        }
    };

    const handleSeed2026 = async () => {
        if (!confirm("Esto precargará feriados inamovibles de Chile 2026. ¿Proceder?")) return;
        setLoading(true);
        try {
            const feriados2026 = [
                { date: '2026-01-01', desc: 'Año Nuevo' },
                { date: '2026-04-03', desc: 'Viernes Santo' },
                { date: '2026-04-04', desc: 'Sábado Santo' },
                { date: '2026-05-01', desc: 'Día Nacional del Trabajo' },
                { date: '2026-05-21', desc: 'Día de las Glorias Navales' },
                { date: '2026-06-21', desc: 'Día Nacional de los Pueblos Indígenas' },
                { date: '2026-06-29', desc: 'San Pedro y San Pablo' },
                { date: '2026-07-16', desc: 'Día de la Virgen del Carmen' },
                { date: '2026-08-15', desc: 'Asunción de la Virgen' },
                { date: '2026-09-18', desc: 'Independencia Nacional' },
                { date: '2026-09-19', desc: 'Día de las Glorias del Ejército' },
                { date: '2026-10-12', desc: 'Encuentro de Dos Mundos' },
                { date: '2026-10-31', desc: 'Día de las Iglesias Evangélicas' },
                { date: '2026-11-01', desc: 'Día de Todos los Santos' },
                { date: '2026-12-08', desc: 'Inmaculada Concepción' },
                { date: '2026-12-25', desc: 'Navidad' },
            ];

            const batch = writeBatch(db);
            feriados2026.forEach(f => {
                const ref = doc(db, "programs", globalActiveYear, "calendario_feriados", f.date);
                batch.set(ref, {
                    date: f.date,
                    description: f.desc,
                    type: 'NACIONAL',
                    active: true
                });
            });
            await batch.commit();
            await loadHolidays();
        } catch (error) {
            console.error(error);
            alert("Error al precargar");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-8">
            <div className="bg-amber-50 px-6 py-4 flex justify-between items-center border-b border-amber-100">
                <div>
                    <h3 className="text-lg font-bold text-amber-900">Calendario de Funciones y Bloqueos {globalActiveYear}</h3>
                    <p className="text-amber-700/70 text-sm">Gestiona días donde el motor automático de Citas no agendará pacientes.</p>
                </div>
                <button
                    onClick={handleSeed2026}
                    disabled={loading}
                    className="px-4 py-2 bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold text-sm rounded-lg transition-colors border border-amber-200"
                >
                    + Precargar Feriados 2026
                </button>
            </div>

            <div className="p-6 bg-slate-50 flex gap-4 items-end border-b border-slate-100">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Fecha Bloqueada</label>
                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-amber-500 font-medium" />
                </div>
                <div className="flex-2 min-w-[200px]">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Motivo / Descripción</label>
                    <input type="text" placeholder="Ej. Aniversario Universidad" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-amber-500" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Tipo</label>
                    <select value={newType} onChange={(e: any) => setNewType(e.target.value)} className="w-full border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-amber-500 font-medium bg-white">
                        <option value="NACIONAL">Feriado Nacional</option>
                        <option value="INSTITUCIONAL">Bloqueo Institucional</option>
                    </select>
                </div>
                <button onClick={handleAdd} disabled={loading || !newDate || !newDesc} className="px-5 py-2 bg-slate-800 text-white font-bold rounded-lg text-sm hover:bg-slate-700 transition disabled:opacity-50">
                    Añadir
                </button>
            </div>

            <div className="p-0">
                {loading && holidays.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Cargando calendario...</div>
                ) : holidays.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">No hay feriados o bloqueos registrados. Las citas se generarán sin restricciones.</div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Fecha</th>
                                <th className="px-6 py-3 font-semibold">Motivo</th>
                                <th className="px-6 py-3 font-semibold">Tipo</th>
                                <th className="px-6 py-3 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {holidays.map(h => (
                                <tr key={h.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-bold text-slate-700">{h.date}</td>
                                    <td className="px-6 py-3">{h.description}</td>
                                    <td className="px-6 py-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.type === 'NACIONAL' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                            {h.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <button onClick={() => handleRemove(h.id)} className="text-rose-500 hover:text-rose-700 p-1">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
