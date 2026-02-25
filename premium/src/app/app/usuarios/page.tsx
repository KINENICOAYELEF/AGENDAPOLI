export default function UsuariosPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Directorio de Usuarios/as</h1>
                    <p className="text-gray-600">Gestión clínica integral del programa respectivo.</p>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition">
                    + Nueva Ficha
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-16 text-center text-gray-500 flex flex-col items-center">
                    <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p className="text-xl font-medium text-gray-700 mb-1">Aún no hay usuarios/as cargados</p>
                    <p className="text-sm">En la fase de migración JSON insertaremos todos los registros aquí.</p>
                </div>
            </div>
        </div>
    );
}
