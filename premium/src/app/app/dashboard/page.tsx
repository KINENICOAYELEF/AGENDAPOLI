"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, AppUser } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { Cita } from "@/types/clinica";
import { AgendaProView } from "@/components/AgendaProView";
import { AgendaGridView } from "@/components/AgendaGridView";
import { UsersService } from "@/services/users";

export default function DashboardPage() {
    const [layoutMode, setLayoutMode] = useState<'LISTA' | 'GRILLA'>('LISTA');
    const { globalActiveYear } = useYear();
    const { user } = useAuth();

    // Data para la grilla
    const [gridCitas, setGridCitas] = useState<(Cita & { internName?: string })[]>([]);
    const [gridLoading, setGridLoading] = useState(false);
    
    // gridScope puede ser 'TODAS', 'MIS_CITAS', o 'UID_DEL_INTERNO'
    const [gridScope, setGridScope] = useState<string>('TODAS');
    
    // Lista de internos (solo para ADMIN/DOCENTE)
    const [internosList, setInternosList] = useState<AppUser[]>([]);

    useEffect(() => {
        if (user && user.role === 'DOCENTE') {
            UsersService.getInterns().then(setInternosList).catch(console.error);
        }
    }, [user]);

    // Cargar citas para la vista de grilla
    useEffect(() => {
        if (layoutMode !== 'GRILLA' || !globalActiveYear || !user) return;

        const fetchGridData = async () => {
            setGridLoading(true);
            try {
                const citasRef = collection(db, "programs", globalActiveYear, "citas");
                const activeStatuses = ["SCHEDULED", "COMPLETED", "NO_SHOW"];
                let allCitas: (Cita & { internName?: string })[] = [];

                // Fetch por status para evitar índices compuestos
                for (const status of activeStatuses) {
                    const q = query(citasRef, where("status", "==", status));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => {
                        allCitas.push({ id: d.id, ...d.data() } as Cita);
                    });
                }

                // Diccionarios de caché para nombres
                const nameMap: Record<string, string> = {}; // usuarias
                const internNameMap: Record<string, string> = {}; // internos
                
                // Pre-poblar caché de internos con la lista cargada (si aplica)
                internosList.forEach(int => {
                    internNameMap[int.uid] = int.displayName || int.email?.split('@')[0] || '';
                });
                
                // Si el usuario actual no está en la caché interna, lo agregamos para "Mis Citas"
                if (!internNameMap[user.uid]) {
                    internNameMap[user.uid] = user.displayName || 'Tú';
                }

                const orphanIds = new Set<string>();

                // 1. Resolver nombres de pacientes faltantes
                const unpopulatedVars = Array.from(new Set(allCitas.filter(c => !c.usuariaName).map(c => c.usuariaId)));
                if (unpopulatedVars.length > 0) {
                    await Promise.all(unpopulatedVars.map(async (uid) => {
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
                }

                // 2. Resolver nombres de internos faltantes (para los que no pasaron por getInterns)
                const missingInternIds = new Set<string>();
                allCitas.forEach(c => {
                    const iid = c.internoPlanificadoId || c.internoAtendioId;
                    if (iid && !internNameMap[iid]) {
                        missingInternIds.add(iid);
                    }
                });

                if (missingInternIds.size > 0) {
                    await Promise.all(Array.from(missingInternIds).map(async (uid) => {
                        try {
                            const snap = await getDoc(doc(db, "users", uid));
                            if (snap.exists()) {
                                const data = snap.data();
                                internNameMap[uid] = data.displayName || data.email?.split('@')[0] || `ID: ${uid.slice(0, 4)}`;
                            } else {
                                internNameMap[uid] = 'Interno Desconocido';
                            }
                        } catch { }
                    }));
                }

                // 3. Aplicar nombres resueltos a las citas y filtrar huérfanas
                allCitas = allCitas.filter(c => !orphanIds.has(c.usuariaId)).map(c => {
                    const result = { ...c };
                    if (!result.usuariaName && nameMap[result.usuariaId]) {
                        result.usuariaName = nameMap[result.usuariaId];
                    }
                    const internId = result.internoPlanificadoId || result.internoAtendioId;
                    if (internId && internNameMap[internId]) {
                        // Solo mostramos nombre de interno si estamos en TODO el calendario.
                        // En "Mis Citas" o si es nuestra grilla no hace tanta falta, pero dejémoslo.
                        result.internName = internNameMap[internId];
                    }
                    return result;
                });

                // 4. Filtrar por Scope
                if (gridScope === 'TODAS') {
                    setGridCitas(allCitas);
                } else if (gridScope === 'MIS_CITAS') {
                    setGridCitas(allCitas.filter(c =>
                        c.internoPlanificadoId === user.uid || c.internoAtendioId === user.uid
                    ));
                } else {
                    // Scope es un UID de un interno específico
                    setGridCitas(allCitas.filter(c =>
                        c.internoPlanificadoId === gridScope || c.internoAtendioId === gridScope
                    ));
                }

            } catch (error) {
                console.error("Error cargando grilla:", error);
            } finally {
                setGridLoading(false);
            }
        };

        fetchGridData();
    }, [layoutMode, globalActiveYear, user, gridScope, internosList]);

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
                    {/* Filtros de la Grilla */}
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={gridScope}
                            onChange={(e) => setGridScope(e.target.value)}
                            className="bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm min-w-[200px]"
                        >
                            <option value="TODAS">📅 Agenda General (Todos)</option>
                            <option value="MIS_CITAS">👤 Solo Mis Citas</option>
                            
                            {user && user.role === 'DOCENTE' && internosList.length > 0 && (
                                <optgroup label="Filtrar por Interno">
                                    {internosList.map(int => (
                                        <option key={int.uid} value={int.uid}>
                                            🎓 {int.displayName || int.email?.split('@')[0]}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>
                    <AgendaGridView citas={gridCitas} loading={gridLoading} />
                </div>
            )}
        </div>
    );
}
