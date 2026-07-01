"use client";

import React, { useEffect, useState } from 'react';
import EntrenamientoRodillaVoz from '@/components/EntrenamientoRodillaVoz';
import { EntrenamientoRodillaDocenteView } from '@/components/EntrenamientoRodillaDocenteView';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function EntrenamientoRodillaPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'simulacion' | 'reportes'>('simulacion');

    useEffect(() => {
        if (user) {
            const isAuthorized = 
                user.role === 'DOCENTE' || 
                user.email === 'deny.contreras14@gmail.com' ||
                user.email === 'kinesiologo.nicolasayelef@gmail.com';
            
            if (!isAuthorized) {
                router.push('/app/dashboard');
            }
        }
    }, [user, router]);

    if (!user) return null;

    const isAuthorized = 
        user.role === 'DOCENTE' || 
        user.email === 'deny.contreras14@gmail.com' ||
        user.email === 'kinesiologo.nicolasayelef@gmail.com';

    if (!isAuthorized) return null;

    return (
        <div className="flex-1 overflow-auto bg-slate-50">
            <div className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 shadow-sm shrink-0">
                <h1 className="text-xl font-bold text-slate-800">
                    Módulo Especial: Rodilla 🦵 {user.role === 'DOCENTE' && '(BETA DOCENTE)'}
                </h1>
                
                {/* Tab selector for Docente */}
                {user.role === 'DOCENTE' && (
                    <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('simulacion')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'simulacion' ? 'bg-white text-slate-850 shadow-sm' : 'text-slate-550 hover:text-slate-700'}`}
                        >
                            🎯 Probar Simulación
                        </button>
                        <button
                            onClick={() => setActiveTab('reportes')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'reportes' ? 'bg-white text-slate-850 shadow-sm' : 'text-slate-550 hover:text-slate-700'}`}
                        >
                            📋 Reportes de Alumnos
                        </button>
                    </div>
                )}
            </div>
            <div className="p-6">
                {user.role === 'DOCENTE' && activeTab === 'reportes' ? (
                    <EntrenamientoRodillaDocenteView />
                ) : (
                    <EntrenamientoRodillaVoz />
                )}
            </div>
        </div>
    );
}
