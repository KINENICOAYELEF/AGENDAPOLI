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
  if (!user || user.role !== 'DOCENTE') return <section className="mx-auto max-w-lg p-8 text-center">
    <h1 className="text-2xl font-bold">Módulo en revisión docente</h1>
    <p className="my-4 text-slate-600">Este contenido todavía no está disponible para internos.</p>
    <Link className="font-bold text-indigo-700" href="/app/dashboard">Volver al inicio</Link>
  </section>;
  return <RepasoMsk uid={user.uid} />;
}
