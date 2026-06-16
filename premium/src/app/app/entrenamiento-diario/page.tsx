import React, { useEffect } from 'react';
import Header from '@/components/Header';
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
            <Header title="Entrenamiento Diario ⚡ (BETA DOCENTE)" />
            <div className="p-6">
                <EntrenamientoDiarioVoz />
            </div>
        </div>
    );
}
