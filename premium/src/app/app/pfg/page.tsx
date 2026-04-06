"use client";

import { useState, useEffect } from "react";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { PfgService } from "@/services/pfg";
import type { PfgDeportista } from "@/types/pfg";
import { PFG_DOMINIOS_CLASIFICACION } from "@/lib/pfg/metrics-config";
import PfgDeportistaForm from "@/components/pfg/PfgDeportistaForm";
import Link from "next/link";
import { motion } from "framer-motion";

export default function PfgListPage() {
  const { activeYear } = useYear();
  const { user } = useAuth();
  const [deportistas, setDeportistas] = useState<PfgDeportista[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<PfgDeportista | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ACTIVO");

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await PfgService.getAll(activeYear);
      setDeportistas(data);
    } catch (err) {
      console.error("Error cargando deportistas PFG:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeYear) fetchData();
  }, [activeYear]);

  const handleSave = async (d: PfgDeportista) => {
    try {
      await PfgService.saveDeportista(activeYear, d);
      setShowForm(false);
      setEditTarget(null);
      await fetchData();
    } catch (err) {
      console.error("Error guardando deportista:", err);
      alert("Error al guardar");
    }
  };

  const handleDelete = async (d: PfgDeportista) => {
    const ok = confirm(`¿Eliminar a "${d.alias}" y todas sus evaluaciones?\n\nEsta acción es irreversible.`);
    if (!ok) return;
    try {
      await PfgService.deleteDeportista(activeYear, d.id);
      await fetchData();
    } catch (err) {
      console.error("Error eliminando deportista:", err);
      alert("Error al eliminar");
    }
  };

  const filtered = deportistas.filter((d) =>
    filterStatus === "TODOS" ? true : d.status === filterStatus
  );

  const compatibleCount = deportistas.filter(
    (d) => d.diagnosticoOperativo.compatibleDolorPatelofemoral
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            📊 PFG Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Dolor Patelofemoral en Karatekas Adolescentes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app/pfg/exportar"
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition shadow-sm"
          >
            📥 Exportar Proyecto
          </Link>
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition shadow-sm"
          >
            + Nuevo Deportista
          </button>
        </div>
      </div>

      {/* KPIs globales del proyecto */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Deportistas", value: deportistas.length, color: "text-slate-700" },
          { label: "Activos", value: deportistas.filter((d) => d.status === "ACTIVO").length, color: "text-emerald-600" },
          { label: "Compatible PFP", value: compatibleCount, color: "text-indigo-600" },
          { label: "Excluidos", value: deportistas.filter((d) => d.status === "EXCLUIDO").length, color: "text-red-500" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{kpi.label}</p>
            <p className={`text-2xl font-black font-mono mt-1 ${kpi.color}`}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter + Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filtrar:</span>
          {["ACTIVO", "INACTIVO", "EXCLUIDO", "TODOS"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filterStatus === s
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  : "bg-slate-50 text-slate-400 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {s === "TODOS" ? "Todos" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-lg font-bold">Sin deportistas</p>
            <p className="text-sm mt-1">Crea el primero con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="text-left px-5 py-3 font-bold">Alias</th>
                  <th className="text-left px-3 py-3 font-bold">Edad</th>
                  <th className="text-left px-3 py-3 font-bold">Rodilla</th>
                  <th className="text-left px-3 py-3 font-bold">Dx PFP</th>
                  <th className="text-left px-3 py-3 font-bold">Clasificación</th>
                  <th className="text-left px-3 py-3 font-bold">Estado</th>
                  <th className="text-right px-5 py-3 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3 font-semibold text-slate-800">{d.alias}</td>
                    <td className="px-3 py-3 text-slate-600 font-mono">{d.edad}</td>
                    <td className="px-3 py-3 text-slate-600">{d.rodillaIndice}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                        d.diagnosticoOperativo.compatibleDolorPatelofemoral
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                      }`}>
                        {d.diagnosticoOperativo.compatibleDolorPatelofemoral ? "✅ Sí" : "— No"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {PFG_DOMINIOS_CLASIFICACION.filter(
                          (dom) => d.clasificacionClinica[dom.key as keyof typeof d.clasificacionClinica] === true
                        ).map((dom) => (
                          <span
                            key={dom.key}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${dom.bgTw} ${dom.textTw}`}
                          >
                            {dom.icon}
                          </span>
                        ))}
                        {PFG_DOMINIOS_CLASIFICACION.filter(
                          (dom) => d.clasificacionClinica[dom.key as keyof typeof d.clasificacionClinica] === true
                        ).length === 0 && (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                        d.status === "ACTIVO"
                          ? "bg-green-100 text-green-700"
                          : d.status === "EXCLUIDO"
                          ? "bg-red-100 text-red-600"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditTarget(d); setShowForm(true); }}
                          className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                          title="Editar deportista"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(d)}
                          className="px-3 py-1 text-xs font-bold text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition"
                          title="Eliminar deportista y sus evaluaciones"
                        >
                          🗑️
                        </button>
                        <Link
                          href={`/app/pfg/${d.id}`}
                          className="px-3 py-1 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                        >
                          Ver →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal form */}
      {showForm && user && (
        <PfgDeportistaForm
          deportista={editTarget}
          createdByUid={user.uid}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}
