"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function AdminDocentePage() {
    const { user, loading } = useAuth();

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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Panel Docente (Admin)</h1>
                <p className="text-gray-600">Configuraciones avanzadas de la plataforma clínica.</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 className="text-red-800 font-bold mb-2">Acceso Premium</h3>
                <p className="text-red-700">
                    Actualmente estás autenticado como DOCENTE. En futuras fases conectaremos este panel a las métricas del curso.
                </p>
            </div>
        </div>
    );
}
