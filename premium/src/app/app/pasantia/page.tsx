"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import PanelDocente from "@/components/pasantia/PanelDocente";

export default function PasantiaDocentePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "DOCENTE")) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "DOCENTE") return null;

  return <PanelDocente />;
}
