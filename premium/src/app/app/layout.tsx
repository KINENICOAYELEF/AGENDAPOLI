"use client";

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useYear } from '@/context/YearContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DebugOverlay } from '@/components/DebugOverlay';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading, logout } = useAuth();
    const { activeYear, availableYears, setWorkingYear, loadingYear } = useYear();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    if (authLoading || loadingYear) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600 font-medium">Verificando sesión y entorno...</p>
                </div>
            </div>
        );
    }

    // If there's no user, we might be in the split second before redirect, so return null
    if (!user) return null;
    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar Desktop / Mobile Drawer */}
            {/* Overlay Móvil */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-indigo-400 tracking-wide">POLIDEPORTIVO</h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <Link href="/app/dashboard" onClick={() => setIsSidebarOpen(false)} className="block px-4 py-2 rounded hover:bg-slate-800 transition">
                        Dashboard
                    </Link>
                    <Link href="/app/usuarios" onClick={() => setIsSidebarOpen(false)} className="block px-4 py-2 rounded hover:bg-slate-800 transition">
                        Personas Usuarias
                    </Link>
                    {user.role === "DOCENTE" && (
                        <Link href="/app/admin" onClick={() => setIsSidebarOpen(false)} className="block px-4 py-2 rounded hover:bg-slate-800 transition text-red-300">
                            Admin Docente
                        </Link>
                    )}
                </nav>

                {/* Separador de Espacio de Nombres (Año) */}
                <div className="px-4 py-4 border-t border-slate-800 shrink-0">
                    <div className="text-xs opacity-50 uppercase tracking-wider font-semibold mb-2">
                        Entorno de Datos
                    </div>
                    {user?.role === "DOCENTE" ? (
                        <select
                            value={activeYear}
                            onChange={(e) => setWorkingYear(e.target.value)}
                            className="w-full bg-slate-800 text-white rounded p-2 text-sm border border-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y}>Año: {y}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="text-sm font-medium text-blue-300">
                            Año activo: {activeYear}
                        </div>
                    )}
                </div>

                {/* User Card Logout */}
                <div className="p-4 border-t border-slate-800 flex flex-col gap-2 shrink-0">
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
            <main className="flex-1 flex flex-col overflow-hidden w-full relative">
                <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <span className="text-gray-500 font-medium">Panel Principal</span>
                    </div>
                </header>
                <div className="flex-1 overflow-auto p-4 sm:p-6 w-full">
                    {children}
                </div>
            </main>

            {/* Inyección de Telemetría Docente (Solo renderiza si ROL === DOCENTE internamente) */}
            <DebugOverlay />
        </div>
    );
}
