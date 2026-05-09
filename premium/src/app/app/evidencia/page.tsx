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
            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                    📚 Biblioteca de Evidencia
                </h1>
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
