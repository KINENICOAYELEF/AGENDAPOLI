'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { SimuladorEstacionesBeta } from '@/components/simulador-estaciones/SimuladorEstacionesBeta';

export default function SimuladorEstacionesPage() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;
  if (user.role !== 'DOCENTE') {
    return (
      <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-5 text-center">
        <div className="mb-5 rounded-3xl bg-rose-50 p-5 text-rose-700">Acceso restringido</div>
        <h1 className="text-2xl font-black text-slate-900">Este simulador todavía está en validación docente</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Los internos no pueden verlo ni abrir sus sesiones hasta que termine la prueba completa.</p>
        <Link href="/app/dashboard" className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">Volver</Link>
      </main>
    );
  }

  return <SimuladorEstacionesBeta />;
}
