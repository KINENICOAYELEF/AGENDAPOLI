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

    // FASE 9: Pantalla de Bloqueo para Usuarios Pendientes
    if (user.role === 'PENDING') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 p-8 space-y-6">
                    <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-amber-50">
                        <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Cuenta en Revisión</h2>
                        <p className="text-slate-500 font-medium leading-relaxed">
                            Tu registro ha sido completado con éxito con el correo <span className="text-slate-700 font-bold">{user.email}</span>, pero requieres autorización de un Docente o Administrador para acceder a las fichas clínicas.
                        </p>
                    </div>
                    
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-sm text-slate-600">
                        Pide a un Docente que apruebe tu acceso desde su panel de administración.
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <button
                            onClick={logout}
                            className="w-full sm:w-auto px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all focus:ring-4 focus:ring-slate-100 outline-none"
                        >
                            Cerrar Sesión e Intentar con otra Cuenta
                        </button>
                    </div>
                </div>
            </div>
        );
    }
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
