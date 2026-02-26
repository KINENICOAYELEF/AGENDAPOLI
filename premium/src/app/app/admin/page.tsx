"use client";

import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useState } from "react";
import Link from "next/link";

export default function AdminDocentePage() {
    const { user, loading } = useAuth();
    const { globalActiveYear, refreshYears } = useYear();
    const [isGenerating, setIsGenerating] = useState(false);

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

    const handleGenerateYears = async () => {
        setIsGenerating(true);
        try {
            await setDoc(doc(db, "programs", "2025", "meta", "settings"), { isActive: false, description: "Año Pasado" }, { merge: true });
            await setDoc(doc(db, "programs", "2026", "meta", "settings"), { isActive: true, description: "Año Actual" }, { merge: true });
            await refreshYears();
            alert("Entornos básicos generados correctamente en Firestore.");
        } catch (e) {
            console.error(e);
            alert("Error al generar años.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleToggleActiveYear = async (targetYear: string) => {
        try {
            const otherYear = targetYear === "2026" ? "2025" : "2026";
            await setDoc(doc(db, "programs", otherYear, "meta", "settings"), { isActive: false }, { merge: true });
            await setDoc(doc(db, "programs", targetYear, "meta", "settings"), { isActive: true }, { merge: true });
            await refreshYears();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Panel Docente (Admin)</h1>
                <p className="text-gray-600">Configuraciones avanzadas de la plataforma clínica.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Control del Espacio-Tiempo (Años de Programa)</h3>
                <p className="text-gray-600 mb-4">
                    Crea las claves base para los universos de datos de Kinesiología y selecciona cuál será el "año en vivo"
                    que los estudiantes (INTERNOS) visualizarán obligatoriamente (Global DB Actual: <strong className="text-blue-600">{globalActiveYear}</strong>).
                </p>

                <div className="flex gap-4 mb-6">
                    <button
                        onClick={handleGenerateYears}
                        disabled={isGenerating}
                        className="px-4 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition"
                    >
                        {isGenerating ? "Creando Tablas..." : "1. Generar Entornos Base (2025 y 2026)"}
                    </button>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => handleToggleActiveYear("2025")}
                        className={`px-4 py-2 border rounded-lg font-medium transition ${globalActiveYear === "2025" ? "bg-blue-50 border-blue-500 text-blue-700" : "border-slate-300 hover:bg-slate-50"}`}
                    >
                        ← Forzar 2025 Global
                    </button>
                    <button
                        onClick={() => handleToggleActiveYear("2026")}
                        className={`px-4 py-2 border rounded-lg font-medium transition ${globalActiveYear === "2026" ? "bg-blue-50 border-blue-500 text-blue-700" : "border-slate-300 hover:bg-slate-50"}`}
                    >
                        Forzar 2026 Global →
                    </button>
                </div>
            </div>
        </div>
    );
}
