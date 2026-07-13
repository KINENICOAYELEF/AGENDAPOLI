"use client";

import { useAuth } from "@/context/AuthContext";
import { EvidenceLibrary } from "@/components/evidence/EvidenceLibrary";
import { StudentEvidenceTasks } from "@/components/evidence/StudentEvidenceTasks";
import { AdminEvidenceManager } from "@/components/evidence/AdminEvidenceManager";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function EvidenciaPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user && user.role !== 'DOCENTE') {
            router.push('/app/dashboard');
        }
    }, [user, loading, router]);

    if (loading || !user || user.role !== 'DOCENTE') return null;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                    📚 Biblioteca de Evidencia
                </h1>
            </div>

            <div className="mb-8">
                <AdminEvidenceManager />
            </div>

            <EvidenceLibrary currentUserId={user.uid} currentUserRole={user.role} currentUserName={user.displayName || user.email || 'Anónimo'} />
        </div>
    );
}
