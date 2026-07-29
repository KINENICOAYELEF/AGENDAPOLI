'use client';

import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import EntrenamientoCaderaVoz from '../../../components/EntrenamientoCaderaVoz';
import { ShieldAlert } from 'lucide-react';

export default function EntrenamientoCaderaPage() {
    const { user } = useAuth();

    if (!user) return null;

    // Vista protegida: Solo Cuentas con Rol DOCENTE
    if (user.role !== 'DOCENTE') {
        return (
            <div className="max-w-md mx-auto my-12 p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 text-white">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                    <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold">Módulo Privado en Desarrollo</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                    Este módulo clínico de entrenamiento de cadera está actualmente en fase de revisión privada por el cuerpo docente y aún no está disponible para estudiantes.
                </p>
            </div>
        );
    }

    return <EntrenamientoCaderaVoz />;
}
