import React from 'react';
import Header from '@/components/Header';
import EntrenamientoDiarioVoz from '@/components/EntrenamientoDiarioVoz';

export default function EntrenamientoDiarioPage() {
    return (
        <div className="flex-1 overflow-auto bg-slate-50">
            <Header title="Entrenamiento Diario ⚡" />
            <div className="p-6">
                <EntrenamientoDiarioVoz />
            </div>
        </div>
    );
}
