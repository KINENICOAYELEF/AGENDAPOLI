import Link from 'next/link';

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
                    <Link href="/app/admin" className="block px-4 py-2 rounded hover:bg-slate-800 transition text-red-300">
                        Admin Docente
                    </Link>
                </nav>
                <div className="p-4 border-t border-slate-800 text-sm opacity-70">
                    Rol: Kinesiólogo/a
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
