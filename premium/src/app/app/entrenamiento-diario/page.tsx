"use client";

import React, { useEffect } from 'react';
import EntrenamientoDiarioVoz from '@/components/EntrenamientoDiarioVoz';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function EntrenamientoDiarioPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user && user.role !== 'DOCENTE') {
            router.push('/app/dashboard');
        }
    }, [user, router]);

    if (!user || user.role !== 'DOCENTE') return null;

    return (
        <div className="flex-1 overflow-auto bg-slate-50">
            <div className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 shadow-sm shrink-0 mb-6">
                <h1 className="text-xl font-bold text-slate-800">Entrenamiento Diario ⚡ (BETA DOCENTE)</h1>
            </div>
            <div className="p-6">
                <EntrenamientoDiarioVoz />
            </div>
        </div>
    );
}
