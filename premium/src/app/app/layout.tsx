"use client";

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600 font-medium">Verificando identidad...</p>
                </div>
            </div>
        );
    }

    // If there's no user, we might be in the split second before redirect, so return null
    if (!user) return null;
    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col">
                <div className="p-4 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-blue-400">SISTEMAKINE</h2>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <Link href="/app/dashboard" className="block px-4 py-2 rounded hover:bg-slate-800 transition">
                        Dashboard
                    </Link>
                    <Link href="/app/usuarios" className="block px-4 py-2 rounded hover:bg-slate-800 transition">
                        Personas Usuarias
                    </Link>
                    {user.role === "DOCENTE" && (
                        <Link href="/app/admin" className="block px-4 py-2 rounded hover:bg-slate-800 transition text-red-300">
                            Admin Docente
                        </Link>
                    )}
                </nav>
                <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
                    <div className="text-xs opacity-50 uppercase tracking-wider font-semibold">
                        ROL: {user.role}
                    </div>
                    <div className="text-sm opacity-70 mb-2 truncate" title={user.email || ''}>
                        {user.email}
                    </div>
                    <button
                        onClick={logout}
                        className="w-full py-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded transition text-sm font-semibold"
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6 shadow-sm">
                    <span className="text-gray-500 font-medium">Panel Principal</span>
                </header>
                <div className="flex-1 overflow-auto p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
