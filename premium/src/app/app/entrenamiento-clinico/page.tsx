'use client';

import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import EntrenamientoClinicoVoz from '../../../components/EntrenamientoClinicoVoz';
import { ShieldAlert } from 'lucide-react';

export default function EntrenamientoClinicoPage() {
    const { user } = useAuth();

    if (!user) return null;

    // Vista protegida: Solo Cuentas con Rol DOCENTE durante fase privada
    if (user.role !== 'DOCENTE') {
        return (
            <div className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-2xl text-center space-y-4 text-slate-900 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                    <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold">Módulo Privado en Revisión Docente</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                    Este módulo clínico de entrenamiento basado en evidencia está actualmente en fase de revisión privada por el equipo docente.
                </p>
            </div>
        );
    }

    return <EntrenamientoClinicoVoz />;
}
