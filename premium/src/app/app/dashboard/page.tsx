export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard General</h1>
            <p className="text-gray-600">Bienvenido al nuevo sistema Premium 2026.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-gray-500 text-sm font-medium">Total Personas Usuarias</h3>
                    <p className="text-3xl font-bold mt-2 text-gray-900">0</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-gray-500 text-sm font-medium">Evoluciones Recientes</h3>
                    <p className="text-3xl font-bold mt-2 text-gray-900">0</p>
                </div>
            </div>
        </div>
    );
}
