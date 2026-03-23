"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { UsersService } from "@/services/users";
import { PersonasUsuariasService } from "@/services/personasUsuarias";
import { AppUser } from "@/context/AuthContext";
import { PersonaUsuaria } from "@/types/personaUsuaria";

export function InternAssignmentManager() {
    const { globalActiveYear } = useYear();

    // Data lists
    const [interns, setInterns] = useState<AppUser[]>([]);
    const [patients, setPatients] = useState<PersonaUsuaria[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection state
    const [selectedInternId, setSelectedInternId] = useState<string>("");
    const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (globalActiveYear) {
            loadInitialData();
        }
    }, [globalActiveYear]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [internList, patientResponse] = await Promise.all([
                UsersService.getInterns(),
                PersonasUsuariasService.getPaginated(globalActiveYear!)
            ]);
            setInterns(internList);
            // Note: We might need more than 20 for assignment, but for now we follow the paginated structure
            // or we could add a dedicated "getAll" for assignment panel.
            setPatients(patientResponse.data);
        } catch (error) {
            console.error("Error loading assignment data:", error);
        } finally {
            setLoading(false);
        }
    };

    const togglePatient = (id: string) => {
        const newSet = new Set(selectedPatientIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPatientIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedPatientIds.size === filteredPatients.length) {
            setSelectedPatientIds(new Set());
        } else {
            setSelectedPatientIds(new Set(filteredPatients.map(p => p.id!)));
        }
    };

    const handleSave = async () => {
        if (!selectedInternId) return alert("Por favor, selecciona un interno.");
        if (selectedPatientIds.size === 0) return alert("Selecciona al menos un paciente.");
        if (!globalActiveYear) return;

        const intern = interns.find(i => i.uid === selectedInternId);
        if (!intern) return;

        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            selectedPatientIds.forEach(id => {
                const docRef = doc(db, "programs", globalActiveYear, "usuarias", id);
                batch.update(docRef, {
                    "meta.assignedInternId": intern.uid,
                    "meta.assignedInternName": intern.displayName || intern.email,
                    "meta.updatedAt": new Date().toISOString()
                });
            });

            await batch.commit();
            alert(`Éxito: ${selectedPatientIds.size} pacientes asignados a ${intern.displayName || intern.email}.`);
            setSelectedPatientIds(new Set());
            loadInitialData();
        } catch (error) {
            console.error("Error saving assignments:", error);
            alert("Error al guardar las asignaciones.");
        } finally {
            setIsSaving(false);
        }
    };

    const filteredPatients = patients.filter(p => {
        const nom = p.identity?.fullName || (p as any).nombreCompleto || "";
        const iden = p.identity?.rut || (p as any).rut || "";
        const str = `${nom} ${iden}`.toLowerCase();
        return str.includes(searchTerm.toLowerCase());
    });

    if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando datos de vinculación...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-900">Gestor de Asignación Masiva</h3>
                    <p className="text-sm text-slate-500 mt-1">Vincula grupos de pacientes a un interno para seguimiento clínico.</p>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* COL 1: SELECCIONAR INTERNO */}
                    <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">1. Seleccionar Interno/a</label>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {interns.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No hay internos registrados.</p>
                            ) : interns.map(i => (
                                <button
                                    key={i.uid}
                                    onClick={() => setSelectedInternId(i.uid)}
                                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                                        selectedInternId === i.uid 
                                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                                        : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                        selectedInternId === i.uid ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                                    }`}>
                                        {(i.displayName || "U").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className={`text-sm font-bold truncate ${selectedInternId === i.uid ? 'text-indigo-900' : 'text-slate-700'}`}>
                                            {i.displayName || "Sin Nombre"}
                                        </div>
                                        <div className="text-[10px] text-slate-400 truncate">{i.email}</div>
                                    </div>
                                    {selectedInternId === i.uid && (
                                        <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* COL 2 & 3: SELECCIONAR PACIENTES */}
                    <div className="md:col-span-2 space-y-4">
                        <div className="flex justify-between items-end">
                            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">2. Seleccionar Pacientes ({selectedPatientIds.size})</label>
                            <button 
                                onClick={handleSelectAll}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                            >
                                {selectedPatientIds.size === filteredPatients.length ? "Desmarcar todos" : "Seleccionar todos filtrados"}
                            </button>
                        </div>

                        <div className="relative">
                            <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"></circle> <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input 
                                type="text"
                                placeholder="Buscar por Nombre o RUT..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar border-t border-slate-50 pt-3">
                            {filteredPatients.length === 0 ? (
                                <p className="col-span-2 text-center py-10 text-slate-400 text-sm italic">No se encontraron pacientes.</p>
                            ) : filteredPatients.map(p => (
                                <label 
                                    key={p.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                        selectedPatientIds.has(p.id!) 
                                        ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                                        : 'bg-white border-slate-100 hover:border-slate-200'
                                    }`}
                                >
                                    <input 
                                        type="checkbox"
                                        checked={selectedPatientIds.has(p.id!)}
                                        onChange={() => togglePatient(p.id!)}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                    />
                                    <div className="flex-1 overflow-hidden">
                                        <div className={`text-sm font-bold truncate ${selectedPatientIds.has(p.id!) ? 'text-emerald-900' : 'text-slate-700'}`}>
                                            {p.identity?.fullName || (p as any).nombreCompleto}
                                        </div>
                                        <div className="text-[10px] text-slate-400 flex justify-between">
                                            <span>{p.identity?.rut || (p as any).rut}</span>
                                            {p.meta?.assignedInternName && (
                                                <span className="text-indigo-500 font-medium">Asig: {p.meta.assignedInternName}</span>
                                            )}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs text-slate-500">Resumen de operación:</p>
                        <p className="text-sm font-bold text-slate-700">
                            {selectedPatientIds.size} pacientes → {interns.find(i => i.uid === selectedInternId)?.displayName || "???"}
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !selectedInternId || selectedPatientIds.size === 0}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-8 py-3 rounded-2xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        )}
                        Ejecutar Asignación Clínica
                    </button>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
}
