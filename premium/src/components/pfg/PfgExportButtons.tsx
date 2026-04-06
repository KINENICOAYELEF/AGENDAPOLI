"use client";

import { useState } from "react";
import type { PfgDeportista, PfgEvaluacion } from "@/types/pfg";
import { generateCSV, generateJSON, downloadFile, generatePDF } from "@/lib/pfg/export-utils";
import { useAuth } from "@/context/AuthContext";

interface Props {
  deportista: PfgDeportista;
  evaluaciones: PfgEvaluacion[];
}

export default function PfgExportButtons({ deportista, evaluaciones }: Props) {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleCSV = () => {
    const csv = generateCSV([{ deportista, evaluaciones }]);
    downloadFile(csv, `PFG_${deportista.alias.replace(/\s+/g, "_")}.csv`, "text/csv;charset=utf-8;");
  };

  const handleJSON = () => {
    const json = generateJSON([{ deportista, evaluaciones }], user?.uid || "");
    downloadFile(json, `PFG_${deportista.alias.replace(/\s+/g, "_")}.json`, "application/json");
  };

  const handlePDF = async () => {
    setExporting(true);
    try {
      await generatePDF(
        "pfg-deportista-pdf",
        `Resumen_${deportista.alias.replace(/\s+/g, "_")}.pdf`
      );
    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("Error al generar el PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCSV}
        className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition shadow-sm"
      >
        📄 CSV
      </button>
      <button
        onClick={handleJSON}
        className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition shadow-sm"
      >
        📄 JSON
      </button>
      <button
        onClick={handlePDF}
        disabled={exporting}
        className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
      >
        {exporting ? "⏳ Generando..." : "📸 PDF Deportista"}
      </button>
    </div>
  );
}
