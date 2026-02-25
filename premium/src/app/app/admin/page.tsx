export default function AdminDocentePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Panel Docente (Admin)</h1>
                <p className="text-gray-600">Configuraciones avanzadas de la plataforma clínica.</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 className="text-red-800 font-bold mb-2">Acceso Restringido</h3>
                <p className="text-red-700">
                    Esta vista requerirá privilegios de rol "Docente" u "Admin" verificados desde el backend Firebase.
                </p>
            </div>
        </div>
    );
}
