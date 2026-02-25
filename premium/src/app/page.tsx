"use client";

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/app/dashboard');
    }
  }, [user, loading, router]);

  if (loading) return null;
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-50 text-gray-900">
      <h1 className="text-4xl font-bold mb-4 text-center">Sistemakine Premium</h1>
      <p className="text-lg text-gray-600 mb-8 max-w-lg text-center">
        Plataforma unificada y moderna para la gestión clínica general y evoluciones docentes.
      </p>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition"
        >
          Iniciar Sesión
        </Link>
      </div>
    </div>
  );
}
