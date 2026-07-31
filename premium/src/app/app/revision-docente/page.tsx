"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { auth } from "@/lib/firebase";
import { BandejaDocenteInteligente } from "@/components/revision-docente/BandejaDocenteInteligente";
import { featureFlags } from "@/lib/agent/config";

import { ResolvedAuthor } from "@/types/clinicalAuthor";
import { buildClinicalRecordLink } from "@/lib/navigation/clinicalRecordLink";

type RecordKind = "EVALUACION" | "EVOLUCION";
type DateRangePreset = "HOY" | "AYER" | "7DIAS" | "HISTORICO";

interface ReviewRecord {
  id: string;
  kind: RecordKind;
  patientId: string;
  patientName: string;
  processId?: string;
  authorUid?: string;
  authorName: string;
  authorDetails?: ResolvedAuthor;
  sessionAt?: string;
  createdAt?: string;
  status?: string;
  summary: string;
  missing: string[];
  alerts: string[];
  priority: "P0" | "P1" | "P2" | "P3";
}

function formatDate(value?: string) {
  if (!value) return "Fecha no registrada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no registrada"
    : date.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
}

export default function RevisionDocentePage() {
  const { user } = useAuth();
  const { globalActiveYear } = useYear();
  const router = useRouter();

  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [datePreset, setDatePreset] = useState<DateRangePreset>("HOY");
  const [kindFilter, setKindFilter] = useState<"TODOS" | RecordKind>("TODOS");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReviewRecord | null>(null);

  const loadInbox = useCallback(async () => {
    if (!globalActiveYear || user?.role !== "DOCENTE") return;
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      let fromStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      let toStr = now.toISOString();

      if (datePreset === "AYER") {
        const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        fromStr = yesterdayStart.toISOString();
        toStr = yesterdayEnd.toISOString();
      } else if (datePreset === "7DIAS") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        fromStr = weekAgo.toISOString();
      } else if (datePreset === "HISTORICO") {
        fromStr = new Date(parseInt(globalActiveYear, 10), 0, 1).toISOString();
      }

      const params = new URLSearchParams({
        year: globalActiveYear,
        from: fromStr,
        to: toStr,
        limit: "50",
      });

      if (kindFilter !== "TODOS") {
        params.append("kind", kindFilter);
      }

      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("No se pudo obtener el token de autenticación del usuario actual");
      }

      const res = await fetch(`/api/teacher/inbox?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      const payload = data.data ?? data;
      setRecords(payload.records || []);
      setSelected(null);
    } catch (err: any) {
      console.error("Error cargando bandeja docente servidor:", err);
      setError("No pudimos cargar la bandeja desde el servidor. Reintenta.");
    } finally {
      setLoading(false);
    }
  }, [globalActiveYear, user?.role, datePreset, kindFilter]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        r.patientName.toLowerCase().includes(q) ||
        r.authorName.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q)
      );
    });
  }, [records, search]);

  const [activeTab, setActiveTab] = useState<'REGISTROS' | 'AGENTE_IA'>('REGISTROS');

  const counts = useMemo(() => {
    return {
      p0: records.filter((r) => r.priority === "P0").length,
      p1: records.filter((r) => r.priority === "P1").length,
      total: records.length,
      drafts: records.filter((r) => r.status === "DRAFT" || r.status === "BORRADOR").length,
    };
  }, [records]);

  if (user?.role !== "DOCENTE") {
    return (
      <div className="max-w-2xl mx-auto bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900">
        Esta bandeja está disponible solo para el equipo docente.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* SELECCIÓN DE PESTAÑA PRINCIPAL BANDEJA */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('REGISTROS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'REGISTROS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span>📋 Registros Clínicos del Día</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-[10px]">
            {records.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('AGENTE_IA')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'AGENTE_IA'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span>🤖 Hallazgos & Feedback IA</span>
        </button>
      </div>

      {activeTab === 'AGENTE_IA' ? (
        <BandejaDocenteInteligente />
      ) : (
        <>

      {/* ENCABEZADO Y PRESETS */}
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 border-t border-slate-200 pt-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" /> Supervisión Clínica Directa
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Bandeja docente</h1>
          <p className="mt-2 text-slate-600 max-w-2xl">
            Consultas incrementales optimizadas en servidor. Mostrando actividad seleccionada en Chile (America/Santiago).
          </p>
        </div>

        <button
          onClick={loadInbox}
          disabled={loading}
          className="inline-flex justify-center items-center gap-2 rounded-xl bg-white border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Actualizando…" : "↻ Actualizar hoy"}
        </button>
      </div>

      {/* PRESETS DE FECHA */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {(["HOY", "AYER", "7DIAS", "HISTORICO"] as DateRangePreset[]).map((preset) => (
          <button
            key={preset}
            onClick={() => setDatePreset(preset)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              datePreset === preset
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {preset === "HOY" && "Hoy"}
            {preset === "AYER" && "Ayer"}
            {preset === "7DIAS" && "Últimos 7 días"}
            {preset === "HISTORICO" && `Año ${globalActiveYear}`}
          </button>
        ))}
      </div>

      {/* TARJETAS RESUMEN */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border p-4 bg-slate-50 border-slate-200 text-slate-800">
          <div className="text-xs font-bold uppercase tracking-wide opacity-70">Registros en Rango</div>
          <div className="mt-1 text-2xl font-black">{counts.total}</div>
        </div>

        <div className="rounded-2xl border p-4 bg-rose-50 border-rose-200 text-rose-900">
          <div className="text-xs font-bold uppercase tracking-wide opacity-70">Prioridad P0 (Seguridad)</div>
          <div className="mt-1 text-2xl font-black">{counts.p0}</div>
        </div>

        <div className="rounded-2xl border p-4 bg-amber-50 border-amber-200 text-amber-900">
          <div className="text-xs font-bold uppercase tracking-wide opacity-70">Prioridad P1 (Atención)</div>
          <div className="mt-1 text-2xl font-black">{counts.p1}</div>
        </div>

        <div className="rounded-2xl border p-4 bg-violet-50 border-violet-200 text-violet-900">
          <div className="text-xs font-bold uppercase tracking-wide opacity-70">Borradores</div>
          <div className="mt-1 text-2xl font-black">{counts.drafts}</div>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar paciente o autor..."
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />

        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as "TODOS" | RecordKind)}
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white"
        >
          <option value="TODOS">Evaluaciones y evoluciones</option>
          <option value="EVALUACION">Solo evaluaciones</option>
          <option value="EVOLUCION">Solo evoluciones</option>
        </select>

        <div className="text-sm text-slate-500 self-center text-right">
          Mostrando <strong className="text-slate-800">{filteredRecords.length}</strong> registros
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</div>}

      {/* LISTADO Y DETALLE */}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_390px] gap-5 items-start">
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 animate-pulse">
              Consultando registros en servidor...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No se encontraron registros en el rango seleccionado ({datePreset}).
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRecords.map((record) => {
                const isSelected = selected?.id === record.id;
                return (
                  <button
                    key={`${record.kind}-${record.id}`}
                    onClick={() => setSelected(record)}
                    className={`w-full text-left p-5 transition ${
                      isSelected ? "bg-indigo-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                          record.kind === "EVALUACION"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {record.kind === "EVALUACION" ? "Evaluación" : "Evolución"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-x-3 gap-y-1 items-baseline">
                          <h2 className="font-bold text-slate-900">{record.patientName}</h2>
                          <span className="text-xs text-slate-500">{formatDate(record.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600 line-clamp-2">{record.summary}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                          <span>Registrado por:</span>
                          <span className="font-bold text-slate-800">{record.authorName}</span>
                          {record.authorDetails?.studentCode && (
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-mono">
                              {record.authorDetails.studentCode}
                            </span>
                          )}
                          {record.authorDetails?.universityCode && (
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {record.authorDetails.universityCode}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {record.priority === "P0" && (
                          <span className="rounded-full bg-rose-600 text-white px-2 py-0.5 text-[10px] font-bold">
                            P0 Seg
                          </span>
                        )}
                        {record.priority === "P1" && (
                          <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-bold">
                            P1 Urg
                          </span>
                        )}
                        {record.status === "DRAFT" && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                            Borrador
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ASIDE DETALLE */}
        <aside className="xl:sticky xl:top-4 rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          {!selected ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Selecciona un registro de la lista para inspeccionar sus detalles.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-black text-indigo-600">
                    Detalle de Registro
                  </div>
                  <h2 className="mt-1 text-xl font-black text-slate-900">{selected.patientName}</h2>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="Cerrar detalle"
                >
                  ✕
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {selected.kind === "EVALUACION" ? "Evaluación" : "Evolución"} · {formatDate(selected.createdAt)}
              </p>

              <div className="mt-5 rounded-xl bg-slate-50 border border-slate-100 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Contenido Registrado</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{selected.summary}</p>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Campos Incompletos</h3>
                {selected.missing.length === 0 ? (
                  <p className="mt-2 text-sm text-emerald-700">Completitud estructural satisfactoria.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {selected.missing.map((item) => (
                      <li key={item} className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-1.5 text-xs text-amber-900">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selected.alerts.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-rose-600">Alertas Detectadas</h3>
                  <ul className="mt-2 space-y-1.5">
                    {selected.alerts.map((item) => (
                      <li key={item} className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-1.5 text-xs text-rose-900">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 space-y-2">
                <button
                  onClick={() =>
                    router.push(`/app/revision-docente/registros/${selected.kind}/${selected.id}`)
                  }
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors"
                >
                  🔍 Ver Registro en Modo Supervisión (Solo Lectura)
                </button>

                <button
                  onClick={() =>
                    router.push(
                      buildClinicalRecordLink({
                        patientId: selected.patientId,
                        processId: selected.processId,
                        recordId: selected.id,
                        recordType: selected.kind,
                        mode: 'readonly',
                        returnTo: 'revision-docente',
                      })
                    )
                  }
                  className="w-full rounded-xl bg-slate-100 border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  📁 Abrir Expediente Completo en Ficha Clínicas
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
      </>
      )}
    </div>
  );
}
