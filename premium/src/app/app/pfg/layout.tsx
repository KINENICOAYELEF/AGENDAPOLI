"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PfgLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "DOCENTE")) {
      router.push("/app/dashboard");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "DOCENTE") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
          <p className="text-sm text-slate-500 font-medium">Verificando acceso PFG...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
