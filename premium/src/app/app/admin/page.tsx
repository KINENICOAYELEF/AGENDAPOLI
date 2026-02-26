"use client";

import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { useState } from "react";
import Link from "next/link";
import { LegacyImporter } from "@/components/LegacyImporter";
import { EvolutionsMigrator } from "@/components/EvolutionsMigrator";

export default function AdminDocentePage() {
    const { user, loading } = useAuth();
    const { globalActiveYear, availableYears, refreshYears } = useYear();
    const [newYearInput, setNewYearInput] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    if (loading || !user) return null;

    if (user.role !== "DOCENTE") {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="bg-red-100 text-red-700 p-4 rounded-full">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Acceso Denegado</h1>
                <p className="text-gray-600 max-w-md">
                    Tu cuenta actual ({user.role}) no tiene los privilegios necesarios para ver el panel de administración docente.
                </p>
                <Link href="/app/dashboard" className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
                    Volver al Dashboard
                </Link>
            </div>
        );
    }

    const handleCreateYear = async () => {
        const yearToCreate = newYearInput.trim();

        // Validaciones básicas UX
        if (!yearToCreate || yearToCreate.length !== 4 || isNaN(Number(yearToCreate))) {
            alert("Por favor ingresa un formato de año válido. Ejemplo: 2027");
            return;
        }

        if (availableYears.includes(yearToCreate)) {
            alert(`El año ${yearToCreate} ya existe en la base de datos.`);
            return;
        }

        setIsProcessing(true);
        try {
            // Creamos el entorno (nace inactivo y seguro)
            await setDocCounted(doc(db, "programs", yearToCreate, "meta", "settings"), {
                isActive: false,
                description: `Periodo Académico ${yearToCreate}`
            }, { merge: true });

            await refreshYears();
            setNewYearInput("");
        } catch (e) {
            console.error(e);
            alert("Error de permisos al generar el nuevo año.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleToggleActiveYear = async (targetYear: string) => {
        if (targetYear === globalActiveYear) return;

        const confirm = window.confirm(
            `⚠️ ADVERTENCIA CRÍTICA ⚠️\n\nEstás a punto de forzar el año ${targetYear} como ACTIVO GLOBAL.\n\nEsto re-encauzará inmediatamente a todos los INTERNOS al universo de datos del ${targetYear} y nadie podrá ver consultas del ${globalActiveYear}.\n\n¿Estás seguro que deseas accionar esta palanca global?`
        );

        if (!confirm) return;

        setIsProcessing(true);
        try {
            // 1. Apagamos el año actual
            await setDocCounted(doc(db, "programs", globalActiveYear, "meta", "settings"), { isActive: false }, { merge: true });
            // 2. Encendemos el año destino
            await setDocCounted(doc(db, "programs", targetYear, "meta", "settings"), { isActive: true }, { merge: true });

            // 3. Forzamos recálculo en la UI del docente
            await refreshYears();
        } catch (e) {
            console.error(e);
            alert("Operación denegada por reglas de seguridad de Firestore.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Panel Docente</h1>
                <p className="text-gray-600">Configuración global de espacios temporales académicos.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

                {/* Cabecera del Panel */}
                <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-white">Gestor de Universos (Años de Programa)</h3>
                        <p className="text-slate-400 text-sm">El año global restringe las lecturas para el Rol INTERNO.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-medium">AÑO GLOBAL ACTIVO:</span>
                        <span className="bg-blue-600 outline outline-offset-2 outline-blue-600 text-white font-black px-3 py-1 rounded shadow-lg text-lg">
                            {globalActiveYear}
                        </span>
                    </div>
                </div>

                {/* Creador de Años */}
                <div className="p-6 border-b border-slate-100 flex gap-4 items-end bg-slate-50">
                    <div className="flex-1">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Aperturar Nuevo Periodo Académico</label>
                        <input
                            type="text"
                            value={newYearInput}
                            onChange={(e) => setNewYearInput(e.target.value)}
                            placeholder="Ej. 2027"
                            maxLength={4}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                        />
                    </div>
                    <button
                        onClick={handleCreateYear}
                        disabled={isProcessing || !newYearInput}
                        className="px-6 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? "Procesando..." : "Crear Entorno"}
                    </button>
                </div>

                {/* Tabla de Años */}
                <div className="p-0">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white text-slate-500 text-sm uppercase tracking-wider border-b border-slate-100">
                                <th className="px-6 py-4 font-semibold">Año Académico</th>
                                <th className="px-6 py-4 font-semibold">Status Real DB</th>
                                <th className="px-6 py-4 font-semibold text-right">Controles Globales</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                            {[...availableYears].sort((a, b) => Number(b) - Number(a)).map(year => {
                                const isGlobalActive = year === globalActiveYear;

                                return (
                                    <tr key={year} className={`hover:bg-slate-50 transition ${isGlobalActive ? 'bg-blue-50/50' : ''}`}>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-lg">{year}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isGlobalActive ? (
                                                <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ring-blue-600/20">
                                                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                                    ACTIVO GLOBAL
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-slate-400/20">
                                                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                                    INACTIVO (Hibernado)
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {!isGlobalActive && (
                                                <button
                                                    onClick={() => handleToggleActiveYear(year)}
                                                    disabled={isProcessing}
                                                    className="px-4 py-1.5 text-sm font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition shadow-sm disabled:opacity-50"
                                                >
                                                    Activar este Año
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Script Migrador Histórico (Fase 1.0) */}
            <EvolutionsMigrator />

            {/* Zona de Importación Histórica (JSON) */}
            <LegacyImporter />
        </div>
    );
}
