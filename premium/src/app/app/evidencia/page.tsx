"use client";

import { useAuth } from "@/context/AuthContext";
import { EvidenceLibrary } from "@/components/evidence/EvidenceLibrary";
import { StudentEvidenceTasks } from "@/components/evidence/StudentEvidenceTasks";
import { AdminEvidenceManager } from "@/components/evidence/AdminEvidenceManager";

export default function EvidenciaPage() {
    const { user, loading } = useAuth();

    if (loading || !user) return null;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">📚 Biblioteca de Evidencia</h1>
                <p className="text-gray-600">Journal Club y repositorio colaborativo de la evidencia clínica.</p>
            </div>

            {user.role === 'INTERNO' && (
                <StudentEvidenceTasks studentId={user.uid} studentName={user.displayName || user.email || "Estudiante"} />
            )}
            
            {user.role === 'DOCENTE' && (
                <div className="mb-8">
                    <AdminEvidenceManager />
                </div>
            )}

            <EvidenceLibrary currentUserId={user.uid} currentUserRole={user.role} currentUserName={user.displayName || user.email || 'Anónimo'} />
        </div>
    );
}
