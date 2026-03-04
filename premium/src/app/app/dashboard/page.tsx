import { AgendaProView } from "@/components/AgendaProView";

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Agenda & Citas</h1>
            <p className="text-gray-600">Gestor de asistencia, coberturas e historial clínico.</p>

            <AgendaProView />
        </div>
    );
}
