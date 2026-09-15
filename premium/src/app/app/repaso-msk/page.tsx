'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';

const RepasoMsk = dynamic(() => import('@/components/repaso-msk/RepasoMsk'), {
  loading: () => <p className="p-8 text-slate-600" role="status">Cargando repaso clínico…</p>,
});

export default function RepasoMskPage() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8" role="status">Verificando acceso…</p>;
  if (!user || (user.role !== 'DOCENTE' && user.role !== 'INTERNO')) return <section className="mx-auto max-w-lg p-8 text-center">
    <h1 className="text-2xl font-bold">Acceso pendiente</h1>
    <p className="my-4 text-slate-600">Este módulo estará disponible cuando tu cuenta sea autorizada como interno o docente.</p>
    <Link className="font-bold text-indigo-700" href="/app/dashboard">Volver al inicio</Link>
  </section>;
  return <><RepasoMsk uid={user.uid} />{user.role === 'DOCENTE' && <Link href="/app/repaso-msk/banco" className="fixed bottom-5 right-5 rounded-full bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg">Administrar banco docente</Link>}</>;
}
