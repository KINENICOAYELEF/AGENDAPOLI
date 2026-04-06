"use client";

import { useState, useEffect } from "react";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { PfgService } from "@/services/pfg";
import type { PfgDeportista, PfgEvaluacion } from "@/types/pfg";
import { generateCSV, generateJSON, downloadFile } from "@/lib/pfg/export-utils";
import Link from "next/link";
import { motion } from "framer-motion";

export default function PfgExportPage() {
  const { activeYear } = useYear();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ deportista: PfgDeportista; evaluaciones: PfgEvaluacion[] }[]>([]);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const deportistas = await PfgService.getAll(activeYear);
        const all = await Promise.all(
          deportistas.map(async (d) => ({
            deportista: d,
            evaluaciones: await PfgService.getEvaluaciones(activeYear, d.id),
          }))
        );
        setData(all);
      } catch (err) {
        console.error("Error cargando datos para exportar:", err);
      } finally {
        setLoading(false);
      }
    }
    if (activeYear) fetch();
  }, [activeYear]);

  const handleCSV = () => {
    const csv = generateCSV(data);
    downloadFile(csv, `PFG_Proyecto_Completo_${activeYear}.csv`, "text/csv;charset=utf-8;");
  };

  const handleJSON = () => {
    const json = generateJSON(data, user?.uid || "");
    downloadFile(json, `PFG_Proyecto_Completo_${activeYear}.json`, "application/json");
  };

  const totalEvals = data.reduce((sum, d) => sum + d.evaluaciones.length, 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/app/pfg" className="hover:text-emerald-600 transition font-medium">PFG Dashboard</Link>
        <span>/</span>
        <span className="text-slate-700 font-bold">Exportar Proyecto</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">📥 Exportar Proyecto</h1>
        <p className="text-sm text-slate-500 mt-1">
          Exportación masiva de todos los deportistas y evaluaciones del proyecto PFG
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Deportistas", value: data.length },
              { label: "Evaluaciones", value: totalEvals },
              { label: "Año", value: activeYear },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
                <p className="text-2xl font-black font-mono text-slate-700 mt-1">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Export buttons */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Formato de exportación</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleCSV}
                disabled={data.length === 0}
                className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition group disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                  📄
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-700">CSV (Investigación)</p>
                  <p className="text-xs text-slate-400 mt-0.5">Una fila por deportista por semana evaluada</p>
                </div>
              </button>

              <button
                onClick={handleJSON}
                disabled={data.length === 0}
                className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition group disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                  🗂️
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-700">JSON (Completo)</p>
                  <p className="text-xs text-slate-400 mt-0.5">Colección completa con estructura anidada</p>
                </div>
              </button>
            </div>

            {data.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-4">
                No hay deportistas registrados para exportar
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
