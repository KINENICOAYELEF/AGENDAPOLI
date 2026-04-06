"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useYear } from "@/context/YearContext";
import { PfgService } from "@/services/pfg";
import type { PfgDeportista, PfgEvaluacion } from "@/types/pfg";
import PfgDashboardAdmin from "@/components/pfg/PfgDashboardAdmin";
import PfgExportButtons from "@/components/pfg/PfgExportButtons";
import Link from "next/link";

export default function PfgDeportistaPage() {
  const params = useParams();
  const deportistaId = params.deportistaId as string;
  const { activeYear } = useYear();
  const [deportista, setDeportista] = useState<PfgDeportista | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<PfgEvaluacion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dep, evals] = await Promise.all([
        PfgService.getById(activeYear, deportistaId),
        PfgService.getEvaluaciones(activeYear, deportistaId),
      ]);
      setDeportista(dep);
      setEvaluaciones(evals);
    } catch (err) {
      console.error("Error cargando datos PFG:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeYear && deportistaId) fetchData();
  }, [activeYear, deportistaId]);

  const handleSaveEval = async (e: PfgEvaluacion) => {
    await PfgService.saveEvaluacion(activeYear, deportistaId, e);
    await fetchData();
  };

  const handleDeleteEval = async (evalId: string) => {
    await PfgService.deleteEvaluacion(activeYear, deportistaId, evalId);
    await fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!deportista) {
    return (
      <div className="text-center py-20">
        <p className="text-xl font-bold text-slate-600">Deportista no encontrado</p>
        <Link href="/app/pfg" className="text-emerald-600 font-bold mt-2 inline-block hover:underline">
          ← Volver a la lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/app/pfg" className="hover:text-emerald-600 transition font-medium">
          PFG Dashboard
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-bold">{deportista.alias}</span>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href={`/app/pfg/${deportistaId}/deportista`}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition shadow-sm"
        >
          👁️ Vista Deportista
        </Link>
        <PfgExportButtons deportista={deportista} evaluaciones={evaluaciones} />
      </div>

      {/* Dashboard */}
      <PfgDashboardAdmin
        deportista={deportista}
        evaluaciones={evaluaciones}
        onSaveEvaluacion={handleSaveEval}
        onDeleteEvaluacion={handleDeleteEval}
      />
    </div>
  );
}
