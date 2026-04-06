"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useYear } from "@/context/YearContext";
import { PfgService } from "@/services/pfg";
import type { PfgDeportista, PfgEvaluacion } from "@/types/pfg";
import PfgDeportistaView from "@/components/pfg/PfgDeportistaView";
import { generatePDF } from "@/lib/pfg/export-utils";
import Link from "next/link";

export default function PfgDeportistaViewPage() {
  const params = useParams();
  const deportistaId = params.deportistaId as string;
  const { activeYear } = useYear();
  const [deportista, setDeportista] = useState<PfgDeportista | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<PfgEvaluacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const [dep, evals] = await Promise.all([
          PfgService.getById(activeYear, deportistaId),
          PfgService.getEvaluaciones(activeYear, deportistaId),
        ]);
        setDeportista(dep);
        setEvaluaciones(evals);
      } catch (err) {
        console.error("Error cargando datos:", err);
      } finally {
        setLoading(false);
      }
    }
    if (activeYear && deportistaId) fetch();
  }, [activeYear, deportistaId]);

  const handlePDF = async () => {
    if (!deportista) return;
    setExporting(true);
    try {
      await generatePDF(
        "pfg-deportista-pdf",
        `Resumen_${deportista.alias.replace(/\s+/g, "_")}.pdf`
      );
    } catch {
      alert("Error al generar el PDF");
    } finally {
      setExporting(false);
    }
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
          ← Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <Link href={`/app/pfg/${deportistaId}`} className="text-sm text-slate-400 hover:text-emerald-600 font-bold transition">
          ← Volver al Dashboard
        </Link>
        <button
          onClick={handlePDF}
          disabled={exporting}
          className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
        >
          {exporting ? "⏳ Generando PDF..." : "📸 Descargar PDF"}
        </button>
      </div>

      {/* Render the athlete view (also the PDF capture target) */}
      <PfgDeportistaView deportista={deportista} evaluaciones={evaluaciones} />
    </div>
  );
}
