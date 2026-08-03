"use client";

import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { LegacyImporter } from "@/components/LegacyImporter";
import { EvolutionsMigrator } from "@/components/EvolutionsMigrator";
import { HolidayManager } from "@/components/HolidayManager";
import { PendingUsersManager } from "@/components/PendingUsersManager";
import { ActiveUsersManager } from "@/components/ActiveUsersManager";
import { InternAssignmentManager } from "@/components/InternAssignmentManager";
import { SimuladorDocentePanel } from "@/components/SimuladorDocentePanel";
import { DefensaDocentePanel } from "@/components/DefensaDocentePanel";
import { TelegramAdminPanel } from "@/components/TelegramAdminPanel";

import { HistorialEvolucionesAdmin } from "@/components/HistorialEvolucionesAdmin";

type AdminPanelKey = "auditoria" | "personal" | "asignaciones" | "evaluaciones" | "telegram" | "mantenimiento";

function AdminLazySection({ title, description, open, onToggle, children }: { title: string; description: string; open: boolean; onToggle: () => void; children: ReactNode }) {
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                    <h2 className="text-base font-black text-slate-900">{title}</h2>
                    <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
                </div>
                <button type="button" onClick={onToggle} aria-expanded={open} className="min-h-11 shrink-0 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                    {open ? "Ocultar módulo" : "Abrir módulo"}
                </button>
            </div>
            {open && <div className="border-t border-slate-100 p-3 sm:p-5">{children}</div>}
        </section>
    );
}

export default function AdminDocentePage() {
    const { user, loading } = useAuth();
    const { globalActiveYear, availableYears, refreshYears } = useYear();
    const [newYearInput, setNewYearInput] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [openPanels, setOpenPanels] = useState<Record<AdminPanelKey, boolean>>({
        auditoria: false,
        personal: false,
        asignaciones: false,
        evaluaciones: false,
        telegram: false,
        mantenimiento: false,
    });
    const togglePanel = (panel: AdminPanelKey) => setOpenPanels(current => ({ ...current, [panel]: !current[panel] }));

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
            // 1. Apagamos el año actual (Solo si existe)
            if (globalActiveYear) {
                await setDocCounted(doc(db, "programs", globalActiveYear, "meta", "settings"), { isActive: false }, { merge: true });
            }
            
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
                <p className="text-gray-600">Configuración global de espacios temporales académicos y auditoría clínica.</p>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">
                <p className="font-black">Carga bajo demanda</p>
                <p className="mt-1 leading-5">Los módulos siguientes consultan datos solo al abrirlos. Así este panel no consume lecturas clínicas cuando solo vienes a una tarea puntual.</p>
            </div>

            <AdminLazySection title="Auditoría de evoluciones" description="Historial, filtros por interno y revisión de actividad clínica." open={openPanels.auditoria} onToggle={() => togglePanel("auditoria")}>
                <HistorialEvolucionesAdmin />
            </AdminLazySection>

            <AdminLazySection title="Personal y accesos" description="Cuentas activas y solicitudes pendientes de aprobación." open={openPanels.personal} onToggle={() => togglePanel("personal")}>
                <div className="space-y-6"><ActiveUsersManager /><PendingUsersManager /></div>
            </AdminLazySection>

            <AdminLazySection title="Asignaciones clínicas" description="Vincula personas usuarias con internos para continuidad y seguimiento." open={openPanels.asignaciones} onToggle={() => togglePanel("asignaciones")}>
                <InternAssignmentManager />
            </AdminLazySection>

            <AdminLazySection title="Simulaciones y defensas" description="Configuración e historial de las evaluaciones académicas." open={openPanels.evaluaciones} onToggle={() => togglePanel("evaluaciones")}>
                <div className="space-y-6"><SimuladorDocentePanel /><DefensaDocentePanel /></div>
            </AdminLazySection>

            <AdminLazySection title="Bot Telegram docente" description="Diagnóstico privado, conexión y prueba del canal de avisos." open={openPanels.telegram} onToggle={() => togglePanel("telegram")}>
                <TelegramAdminPanel />
            </AdminLazySection>

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

            <AdminLazySection title="Mantenimiento y respaldo" description="Feriados, normalización histórica e importación de respaldos. Úsalo solo cuando corresponda." open={openPanels.mantenimiento} onToggle={() => togglePanel("mantenimiento")}>
                <div className="space-y-6"><HolidayManager /><EvolutionsMigrator /><LegacyImporter /></div>
            </AdminLazySection>
        </div>
    );
}
