"use client";

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { DefensaExamenVozDocente } from '@/components/DefensaExamenVozDocente';

export default function DefensaVozDocentePage() {
    const { user, loading } = useAuth();

    if (loading || !user) return null;

    if (user.role !== "DOCENTE") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 py-12">
                <div className="bg-red-100 text-red-700 p-4 rounded-full">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Acceso Denegado</h1>
                <p className="text-gray-600 max-w-md">
                    Tu cuenta actual ({user.role}) no tiene los privilegios necesarios para ver esta versión de desarrollo/docente.
                </p>
                <Link href="/app/dashboard" className="mt-4 px-6 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition">
                    Volver al Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
            <DefensaExamenVozDocente />
        </div>
    );
}
