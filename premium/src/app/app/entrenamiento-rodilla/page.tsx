"use client";

import React, { useEffect } from 'react';
import EntrenamientoRodillaVoz from '@/components/EntrenamientoRodillaVoz';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function EntrenamientoRodillaPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user) {
            const isAuthorized = 
                user.role === 'DOCENTE' || 
                user.email === 'deny.contreras14@gmail.com';
            
            if (!isAuthorized) {
                router.push('/app/dashboard');
            }
        }
    }, [user, router]);

    if (!user) return null;

    const isAuthorized = 
        user.role === 'DOCENTE' || 
        user.email === 'deny.contreras14@gmail.com';

    if (!isAuthorized) return null;

    return (
        <div className="flex-1 overflow-auto bg-slate-50">
            <div className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 shadow-sm shrink-0">
                <h1 className="text-xl font-bold text-slate-800">
                    Módulo Especial: Rodilla 🦵 {user.role === 'DOCENTE' && '(BETA DOCENTE)'}
                </h1>
            </div>
            <div className="p-6">
                <EntrenamientoRodillaVoz />
            </div>
        </div>
    );
}
