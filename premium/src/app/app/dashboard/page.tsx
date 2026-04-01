"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { Cita } from "@/types/clinica";
import { AgendaProView } from "@/components/AgendaProView";
import { AgendaGridView } from "@/components/AgendaGridView";
import { format, startOfWeek, addDays } from "date-fns";

export default function DashboardPage() {
    const [layoutMode, setLayoutMode] = useState<'LISTA' | 'GRILLA'>('LISTA');
    const { globalActiveYear } = useYear();
    const { user } = useAuth();

    // Data para la grilla (carga semana completa independiente)
    const [gridCitas, setGridCitas] = useState<Cita[]>([]);
    const [gridLoading, setGridLoading] = useState(false);
    const [gridScope, setGridScope] = useState<'MIS_CITAS' | 'TODAS'>('TODAS');

    // Cargar citas para la vista de grilla
    useEffect(() => {
        if (layoutMode !== 'GRILLA' || !globalActiveYear || !user) return;

        const fetchGridData = async () => {
            setGridLoading(true);
            try {
                // Cargar todas las citas no canceladas (la grilla tiene su propia navegación de semana)
                const citasRef = collection(db, "programs", globalActiveYear, "citas");
                const activeStatuses = ["SCHEDULED", "COMPLETED", "NO_SHOW"];
                const allCitas: Cita[] = [];

                // Fetch por status para evitar índices compuestos
                for (const status of activeStatuses) {
                    const q = query(citasRef, where("status", "==", status));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => {
                        allCitas.push({ id: d.id, ...d.data() } as Cita);
                    });
                }

                // Lazy-load nombres faltantes
                const unpopulated = Array.from(new Set(allCitas.filter(c => !c.usuariaName).map(c => c.usuariaId)));
                if (unpopulated.length > 0) {
                    const nameMap: Record<string, string> = {};
                    const orphanIds = new Set<string>();
                    await Promise.all(unpopulated.map(async (uid) => {
                        try {
                            const snap = await getDoc(doc(db, "programs", globalActiveYear, "usuarias", uid));
                            if (snap.exists()) {
                                const data = snap.data();
                                nameMap[uid] = data.identity?.fullName || data.nombreCompleto || `ID: ${uid.slice(0, 6)}`;
                            } else {
                                orphanIds.add(uid);
                            }
                        } catch { }
                    }));

                    allCitas.forEach((c, i) => {
                        if (!c.usuariaName && nameMap[c.usuariaId]) {
                            allCitas[i] = { ...c, usuariaName: nameMap[c.usuariaId] };
                        }
                    });

                    // Filtrar huérfanas
                    const filtered = allCitas.filter(c => !orphanIds.has(c.usuariaId));

                    // Filtrar por scope
                    if (gridScope === 'MIS_CITAS') {
                        setGridCitas(filtered.filter(c =>
                            c.internoPlanificadoId === user.uid || c.internoAtendioId === user.uid
                        ));
                    } else {
                        setGridCitas(filtered);
                    }
                } else {
                    if (gridScope === 'MIS_CITAS') {
                        setGridCitas(allCitas.filter(c =>
                            c.internoPlanificadoId === user.uid || c.internoAtendioId === user.uid
                        ));
                    } else {
                        setGridCitas(allCitas);
                    }
                }
            } catch (error) {
                console.error("Error cargando grilla:", error);
            } finally {
                setGridLoading(false);
            }
        };

        fetchGridData();
    }, [layoutMode, globalActiveYear, user, gridScope]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Agenda & Citas</h1>
                    <p className="text-gray-600">Gestor de asistencia, coberturas e historial clínico.</p>
                </div>
                {/* Layout Toggle */}
                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-200/70 p-1 rounded-xl">
                        <button
                            onClick={() => setLayoutMode('LISTA')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${layoutMode === 'LISTA' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                            Lista
                        </button>
                        <button
                            onClick={() => setLayoutMode('GRILLA')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${layoutMode === 'GRILLA' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                            Grilla
                        </button>
                    </div>
                </div>
            </div>

            {layoutMode === 'LISTA' ? (
                <AgendaProView />
            ) : (
                <div className="space-y-4">
                    {/* Filtro de scope para la grilla */}
                    <div className="flex items-center gap-3">
                        <select
                            value={gridScope}
                            onChange={(e) => setGridScope(e.target.value as any)}
                            className="bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm"
                        >
                            <option value="TODAS">📅 Agenda General (Todos)</option>
                            <option value="MIS_CITAS">👤 Solo Mis Citas</option>
                        </select>
                    </div>
                    <AgendaGridView citas={gridCitas} loading={gridLoading} />
                </div>
            )}
        </div>
    );
}
