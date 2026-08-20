"use client";

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useYear } from '@/context/YearContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DebugOverlay } from '@/components/DebugOverlay';
import { SimuladorAlertaModal } from '@/components/SimuladorAlertaModal';
import { NotificationCenter } from '@/components/NotificationCenter';
import { AssignmentDecisionGate } from '@/components/AssignmentDecisionGate';
import { StudentClinicalTaskBanner } from '@/components/StudentClinicalTaskBanner';
import { 
    LayoutDashboard, 
    Users, 
    GraduationCap, 
    Mic, 
    MessageSquare, 
    ShieldCheck, 
    Layers, 
    LogOut,
    Menu,
    X,
    Calendar,
    Sparkles,
    BookOpen,
    Activity,
    HeartPulse
} from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading, logout } = useAuth();
    const { activeYear, availableYears, setWorkingYear, loadingYear } = useYear();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    if (authLoading || loadingYear) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm font-medium">Cargando entorno Polideportivo...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    // FASE 9: Pantalla de Bloqueo para Usuarios Pendientes
    if (user.role === 'PENDING') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 p-8 space-y-6">
                    <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-amber-50">
                        <ShieldCheck className="w-10 h-10 text-amber-600" />
                    </div>
                    
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Cuenta en Revisión</h2>
                        <p className="text-slate-500 font-medium leading-relaxed">
                            Tu registro ha sido completado con éxito con el correo <span className="text-slate-700 font-bold">{user.email}</span>, pero requieres autorización de un Docente para acceder.
                        </p>
                    </div>
                    
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-sm text-slate-600">
                        Pide a un Docente que apruebe tu acceso desde su panel de administración.
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <button
                            onClick={logout}
                            className="w-full px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all outline-none"
                        >
                            Cerrar Sesión e Intentar con otra Cuenta
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const isActive = (path: string) => pathname === path;

    return (
        <div className="flex h-screen bg-slate-100/70 font-sans text-slate-900">
            <SimuladorAlertaModal />
            <StudentClinicalTaskBanner />
            
            {/* Overlay Móvil */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar Principal */}
            <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-950 text-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out border-r border-slate-800/80 shadow-2xl md:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                {/* Header Marca */}
                <div className="p-5 border-b border-slate-800/80 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-600/30">
                            P
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-tight text-white leading-tight">POLIDEPORTIVO</h2>
                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Kinesiología</span>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navegación por Secciones */}
                <nav className="flex-1 p-3 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Grupo 1: Atención Clínica */}
                    <div className="space-y-1">
                        <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-2">
                            Atención Clínica
                        </span>

                        <Link
                            href="/app/dashboard"
                            onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                isActive('/app/dashboard')
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                            }`}
                        >
                            <LayoutDashboard className="w-4 h-4 shrink-0" />
                            <span>Dashboard (Agenda)</span>
                        </Link>

                        <Link
                            href="/app/usuarios"
                            onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                isActive('/app/usuarios')
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                            }`}
                        >
                            <Users className="w-4 h-4 shrink-0" />
                            <span>Personas Usuarias</span>
                        </Link>

                        <Link
                            href="/app/taller-adulto-mayor"
                            onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                isActive('/app/taller-adulto-mayor')
                                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                            }`}
                        >
                            <HeartPulse className="w-4 h-4 shrink-0 text-teal-300" />
                            <span>Taller Adulto Mayor</span>
                        </Link>
                    </div>

                    {/* Grupo 2: Formación y Simulaciones */}
                    <div className="space-y-1">
                        <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-2">
                            Formación & Simulación
                        </span>

                        <Link
                            href="/app/simulador"
                            onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                isActive('/app/simulador')
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                            }`}
                        >
                            <GraduationCap className="w-4 h-4 shrink-0 text-amber-400" />
                            <span>Simulador Examen (Escrito)</span>
                        </Link>

                        <Link
                            href="/app/simulador-voz"
                            onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                isActive('/app/simulador-voz')
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                            }`}
                        >
                            <Mic className="w-4 h-4 shrink-0 text-orange-400" />
                            <span>Simulador Voz (OSCE)</span>
                        </Link>

                        <Link
                            href="/app/defensa-voz"
                            onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                isActive('/app/defensa-voz')
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                            }`}
                        >
                            <MessageSquare className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>Defensa Comisión</span>
                        </Link>

                        <Link
                            href="/app/entrenamiento-clinico"
                            onClick={() => setIsSidebarOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                isActive('/app/entrenamiento-clinico') && (!pathname.includes('tab=ANTIGRAVITY_AGENT'))
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                            }`}
                        >
                            <Activity className="w-4 h-4 shrink-0 text-purple-400" />
                            <span>Entrenamiento Clínico EBM</span>
                        </Link>
                    </div>

                    {/* Grupo 3: Solo Módulos Docentes (Oculto para Internos) */}
                    {user.role === 'DOCENTE' && (
                        <div className="space-y-1 pt-2 border-t border-slate-800/80">
                            <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-rose-400 block mb-2">
                                Gestión Docente
                            </span>

                            <Link
                                href="/app/admin"
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    isActive('/app/admin') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                }`}
                            >
                                <ShieldCheck className="w-4 h-4 text-rose-400" />
                                <span>Panel Admin Docente</span>
                            </Link>

                            <Link
                                href="/app/revision-docente"
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    isActive('/app/revision-docente') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                }`}
                            >
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                <span>Bandeja Auditoría</span>
                            </Link>

                            <Link
                                href="/app/simulador-estaciones"
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    isActive('/app/simulador-estaciones') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                }`}
                            >
                                <Mic className="w-4 h-4 text-cyan-400" />
                                <span>Simulador Estaciones <span className="ml-1 rounded bg-cyan-400/15 px-1.5 py-0.5 text-[9px] text-cyan-300">BETA</span></span>
                            </Link>


                            <Link
                                href="/app/admin/rotaciones"
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    isActive('/app/admin/rotaciones') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                }`}
                            >
                                <Calendar className="w-4 h-4 text-emerald-400" />
                                <span>Rotaciones Clínicas</span>
                            </Link>

                            <Link
                                href="/app/pasantia"
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    isActive('/app/pasantia') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                }`}
                            >
                                <BookOpen className="w-4 h-4 text-cyan-400" />
                                <span>Pasantía 2º Año</span>
                            </Link>
                        </div>
                    )}
                </nav>

                {/* Selector de Año del Entorno */}
                <div className="px-4 py-3 border-t border-slate-800/80 shrink-0 bg-slate-900/40">
                    <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Año Activo</span>
                        </span>
                        {user?.role === "DOCENTE" ? (
                            <select
                                value={activeYear}
                                onChange={(e) => setWorkingYear(e.target.value)}
                                className="bg-slate-800 text-xs font-bold text-white rounded-lg px-2 py-1 border border-slate-700 focus:outline-none cursor-pointer"
                            >
                                {availableYears.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        ) : (
                            <span className="text-xs font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/50">
                                {activeYear}
                            </span>
                        )}
                    </div>
                </div>

                {/* Tarjeta Minimalista del Usuario y Salida */}
                <div className="p-3 border-t border-slate-800/80 shrink-0 bg-slate-950">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                {(user.displayName || user.email || 'I')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-200 block truncate leading-tight">
                                    {user.displayName || user.email?.split('@')[0]}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block leading-tight">
                                    {user.role === 'DOCENTE' ? '👑 Docente' : '🎓 Interno'}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={logout}
                            title="Cerrar Sesión"
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Contenido Principal */}
            <main className="flex-1 flex flex-col overflow-hidden w-full relative">
                {/* Header Superior */}
                <header className="bg-white border-b border-slate-200/80 h-16 flex items-center justify-between px-4 sm:px-6 shadow-xs shrink-0">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsSidebarOpen(true)} 
                            className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block leading-none mb-0.5">
                                {user.role === 'DOCENTE' ? 'Panel de Supervisión Docente' : 'Espacio del Interno'}
                            </span>
                            <span className="text-sm font-bold text-slate-800 block leading-none">
                                Hola, {user.displayName || user.email?.split('@')[0]} 👋
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <NotificationCenter />
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-4 sm:p-6 w-full">
                    {/* Bloquea la plataforma hasta declarar a cargo de quién
                        está una persona que se atendió sin tenerla asignada. */}
                    <AssignmentDecisionGate />
                    {children}
                </div>
            </main>

            {/* Inyección de Telemetría Docente */}
            <DebugOverlay />
        </div>
    );
}
