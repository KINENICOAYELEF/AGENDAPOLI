"use client";

import { useState, useEffect, useCallback } from "react";
import { getTodasLasEntregas, guardarRevisionDocente } from "@/services/pasantia";
import { calcularNota } from "@/types/pasantia";
import type {
  EntregaConRevision,
  CasoClinco,
  RevisionDocente,
  PuntajesCriterios,
  RevisionIAResultado,
  EstadoEntrega,
} from "@/types/pasantia";

// ─── Rúbrica Criterios ─────────────────────────────────────────────────────
const CRITERIOS: { key: keyof PuntajesCriterios; label: string; desc: string; iaOnly?: boolean }[] = [
  { key: "c1", label: "C1 · Responsabilidad y profesionalismo", desc: "Cumple con puntualidad, uniforme institucional, respeto por normas de la institución." },
  { key: "c2", label: "C2 · Habilidades interpersonales", desc: "Muestra proactividad, trato empático con la usuaria, lenguaje acorde, respeto por los datos obtenidos." },
  { key: "c3", label: "C3 · Entrevista / Anamnesis", desc: "La entrevista es pertinente, está ejecutada correctamente y los datos se ordenan de manera correcta." },
  { key: "c4", label: "C4 · Evaluaciones iniciales", desc: "Las evaluaciones son pertinentes, se ejecutan correctamente y los resultados se interpretan correctamente." },
  { key: "c5", label: "C5 · Tabla CIF", desc: "La tabla CIF es coherente con la observación, entrevista y evaluación." },
  { key: "c6", label: "C6 · Diagnóstico kinesiológico", desc: "El diagnóstico kinesiológico es coherente con el modelo de acción profesional y prioriza las necesidades de la persona." },
];

const ESCALA = [1, 2, 3, 4, 5] as const;

function ScoreSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ["", "No cumple", "Cumple 1 aspecto", "Cumple 2 aspectos", "Cumple 3 aspectos", "Cumple a cabalidad"];
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {ESCALA.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          title={labels[n]}
          className={`w-10 h-10 rounded-xl text-sm font-black border-2 transition ${
            value === n
              ? "bg-teal-600 border-teal-600 text-white shadow-md"
              : "bg-white border-slate-300 text-slate-500 hover:border-teal-400 hover:text-teal-600"
          }`}
        >
          {n}
        </button>
      ))}
      {value > 0 && <span className="self-center text-xs text-slate-500 ml-1">{labels[value]}</span>}
    </div>
  );
}

// ─── Campo CIF compacto ─────────────────────────────────────────────────────
function CifRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-2">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{value || <span className="text-slate-400 italic">Sin completar</span>}</p>
    </div>
  );
}

// ─── Vista de caso (readonly) ───────────────────────────────────────────────
function VistaCaso({ caso, num }: { caso: CasoClinco; num: number }) {
  const [open, setOpen] = useState(num === 1);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition font-bold text-slate-800 text-sm"
      >
        <span>📋 Caso {num} – {caso.datosUsuaria.nombre || "Sin nombre"}</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="p-5 space-y-5 text-sm">
          <div>
            <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Datos generales</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
              <span><strong>Nombre:</strong> {caso.datosUsuaria.nombre}</span>
              <span><strong>Edad:</strong> {caso.datosUsuaria.edad}</span>
              <span><strong>Ocupación:</strong> {caso.datosUsuaria.ocupacion}</span>
              <span><strong>Contexto:</strong> {caso.datosUsuaria.contextoAtencion}</span>
            </div>
            <div className="mt-2 bg-slate-50 rounded-lg p-3 text-slate-700 text-xs">{caso.datosUsuaria.motivoConsulta}</div>
          </div>

          <div>
            <h4 className="font-bold text-slate-700 mb-1 text-xs uppercase tracking-wider">Anamnesis</h4>
            <div className="bg-slate-50 rounded-lg p-3 text-slate-700 whitespace-pre-wrap text-xs">{caso.anamnesis}</div>
            <h4 className="font-bold text-slate-700 mt-3 mb-1 text-xs uppercase tracking-wider">Interpretación de la anamnesis</h4>
            <div className="bg-blue-50 rounded-lg p-3 text-blue-900 whitespace-pre-wrap text-xs">{caso.interpretacionAnamnesis}</div>
          </div>

          <div>
            <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Evaluaciones ({caso.evaluaciones.length})</h4>
            {caso.evaluaciones.map((ev, i) => (
              <div key={ev.id} className="border border-slate-200 rounded-xl p-3 mb-2 space-y-1">
                <p className="font-semibold text-slate-800">{i + 1}. {ev.nombre}</p>
                <p className="text-xs text-slate-500"><strong>Por qué:</strong> {ev.razon}</p>
                <p className="text-xs text-slate-500"><strong>Resultado:</strong> {ev.resultado}</p>
                <p className="text-xs text-slate-600"><strong>Interpretación:</strong> {ev.interpretacion}</p>
              </div>
            ))}
          </div>

          <div>
            <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Hallazgos principales</h4>
            {[caso.hallazgo1, caso.hallazgo2, caso.hallazgo3].map((h, i) => (
              <p key={i} className="text-xs text-slate-700 mb-1"><span className="font-semibold text-teal-700">{i + 1}.</span> {h}</p>
            ))}
          </div>

          <div>
            <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Tabla CIF</h4>
            <div className="bg-slate-50 rounded-xl p-4 space-y-1">
              <CifRow label="Estructuras corporales" value={caso.cif.estructurasCorporales} />
              <CifRow label="Funciones corporales" value={caso.cif.funcionesCorporales} />
              <CifRow label="Actividades" value={caso.cif.actividades} />
              <CifRow label="Participación" value={caso.cif.participacion} />
              <CifRow label="Factores personales" value={caso.cif.factoresPersonales} />
              <CifRow label="Factores ambientales" value={caso.cif.factoresAmbientales} />
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-700 mb-1 text-xs uppercase tracking-wider">Diagnóstico Kinesiológico Incipiente</h4>
            <div className="bg-indigo-50 rounded-lg p-3 text-indigo-900 whitespace-pre-wrap text-xs">{caso.diagnosticoKinesiologico}</div>
          </div>

          <div>
            <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider">Autoevaluación de la dupla</h4>
            <div className="space-y-2 text-xs text-slate-600">
              <p><strong>Dificultad:</strong> {caso.autoevaluacion.mayorDificultad || "No respondió"}</p>
              <p><strong>Info faltante:</strong> {caso.autoevaluacion.informacionFaltante || "No respondió"}</p>
              <p><strong>Mejoras:</strong> {caso.autoevaluacion.mejoras || "No respondió"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel de revisión IA ───────────────────────────────────────────────────
function PanelRevisionIA({ resultado }: { resultado: RevisionIAResultado }) {
  return (
    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 space-y-4 text-sm">
      <p className="font-black text-violet-800 flex items-center gap-2">🤖 Revisión con IA</p>
      <div className="space-y-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs font-bold text-green-700 mb-1">✅ Fortalezas</p>
          <p className="text-green-900 text-xs">{resultado.fortalezas}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs font-bold text-red-700 mb-1">⚠️ Errores o vacíos</p>
          <p className="text-red-900 text-xs">{resultado.errores}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs font-bold text-amber-700 mb-1">💡 Sugerencia</p>
          <p className="text-amber-900 text-xs">{resultado.sugerencia}</p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
          <p className="text-xs font-bold text-violet-700 mb-1">📝 Puntajes sugeridos (orientativos)</p>
          <div className="grid grid-cols-4 gap-2 mt-1">
            {(["c3", "c4", "c5", "c6"] as const).map((k) => (
              <div key={k} className="text-center bg-white rounded-lg p-2 border border-violet-200">
                <p className="text-xs text-violet-500 font-bold">{k.toUpperCase()}</p>
                <p className="text-2xl font-black text-violet-700">{resultado.puntajesSugeridos[k]}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <p className="text-xs font-bold text-slate-600 mb-1">💬 Comentario para la dupla</p>
          <p className="text-slate-800 text-xs italic">&quot;{resultado.comentarioRetroalimentacion}&quot;</p>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Revisión ─────────────────────────────────────────────────────────
function ModalRevision({ entrega, onClose, onSaved }: { entrega: EntregaConRevision; onClose: () => void; onSaved: () => void }) {
  const defaultPuntajes: PuntajesCriterios = entrega.revision?.puntajes ?? { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 };
  const [puntajes, setPuntajes] = useState<PuntajesCriterios>(defaultPuntajes);
  const [comentario, setComentario] = useState(entrega.revision?.comentarioDocente ?? "");
  const [estadoRevision, setEstadoRevision] = useState<EstadoEntrega>(entrega.revision?.estadoRevision ?? "revisado");
  const [loadingIA, setLoadingIA] = useState<Record<string, boolean>>({});
  const [revisionIA, setRevisionIA] = useState<{ caso1?: RevisionIAResultado; caso2?: RevisionIAResultado }>(entrega.revision?.revisionIA ?? {});
  const [saving, setSaving] = useState(false);
  const [casoTab, setCasoTab] = useState<1 | 2>(1);

  const puntajeTotal = Object.values(puntajes).reduce((a, b) => a + b, 0);
  const { nota, porcentaje, aprobado } = calcularNota(puntajeTotal);
  const allScored = Object.values(puntajes).every((v) => v > 0);

  const revisarConIA = async (num: 1 | 2) => {
    const key = `caso${num}` as "caso1" | "caso2";
    setLoadingIA((p) => ({ ...p, [key]: true }));
    try {
      const resp = await fetch("/api/pasantia/revisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caso: entrega[key], numeroCaso: num }),
      });
      const json = await resp.json();
      if (json.success) {
        setRevisionIA((prev) => ({ ...prev, [key]: json.data }));
        // Suggest scores
        const sugeridos = json.data.puntajesSugeridos;
        setPuntajes((prev) => ({
          ...prev,
          c3: prev.c3 === 0 ? sugeridos.c3 : prev.c3,
          c4: prev.c4 === 0 ? sugeridos.c4 : prev.c4,
          c5: prev.c5 === 0 ? sugeridos.c5 : prev.c5,
          c6: prev.c6 === 0 ? sugeridos.c6 : prev.c6,
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingIA((p) => ({ ...p, [key]: false }));
    }
  };

  const handleSave = async () => {
    if (!allScored) return;
    setSaving(true);
    try {
      const revision: RevisionDocente = {
        puntajes,
        comentarioDocente: comentario,
        notaFinal: nota,
        puntajeTotal,
        porcentaje,
        aprobado,
        revisadoEn: new Date().toISOString(),
        estadoRevision,
        revisionIA,
      };
      await guardarRevisionDocente(entrega.id!, revision);
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-6 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
          <div>
            <p className="text-xs text-slate-300 mb-0.5">Revisión de entrega</p>
            <h2 className="font-black text-lg">{entrega.dupla.estudiante1} & {entrega.dupla.estudiante2}</h2>
            <p className="text-xs text-slate-400">{new Date(entrega.enviadoEn ?? entrega.creadoEn).toLocaleString("es-CL")}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
            <span className="text-lg">✕</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Tabs casos */}
          <div className="flex gap-2">
            {([1, 2] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCasoTab(n)}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition ${casoTab === n ? "bg-teal-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                Caso {n}
              </button>
            ))}
          </div>

          {/* Vista del caso */}
          <VistaCaso caso={casoTab === 1 ? entrega.caso1 : entrega.caso2} num={casoTab} />

          {/* IA Review */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => revisarConIA(casoTab)}
              disabled={loadingIA[`caso${casoTab}`]}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-xl hover:from-violet-700 hover:to-purple-800 transition disabled:opacity-50 text-sm shadow"
            >
              {loadingIA[`caso${casoTab}`] ? "🔄 Analizando con IA..." : `🤖 Revisar Caso ${casoTab} con IA`}
            </button>
            {revisionIA[`caso${casoTab}` as "caso1" | "caso2"] && (
              <PanelRevisionIA resultado={revisionIA[`caso${casoTab}` as "caso1" | "caso2"]!} />
            )}
          </div>

          {/* Rúbrica */}
          <div className="border border-slate-200 rounded-2xl p-5">
            <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">📊 Rúbrica de evaluación</h3>
            <div className="space-y-5">
              {CRITERIOS.map((c) => (
                <div key={c.key}>
                  <p className="text-sm font-bold text-slate-700">{c.label}</p>
                  <p className="text-xs text-slate-500 mb-1">{c.desc}</p>
                  <ScoreSelector value={puntajes[c.key]} onChange={(v) => setPuntajes((p) => ({ ...p, [c.key]: v }))} />
                </div>
              ))}
            </div>
          </div>

          {/* Nota calculada */}
          <div className={`rounded-2xl p-5 ${aprobado ? "bg-green-50 border border-green-300" : "bg-red-50 border border-red-300"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Resultado</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-5xl font-black ${aprobado ? "text-green-700" : "text-red-700"}`}>{nota.toFixed(1)}</span>
                  <span className="text-slate-500 text-sm">/7.0</span>
                </div>
                <p className="text-sm font-medium text-slate-600 mt-1">
                  Puntaje: {puntajeTotal}/30 · {porcentaje}%
                </p>
              </div>
              <div className={`px-5 py-2 rounded-full text-sm font-black shadow-sm ${aprobado ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
                {aprobado ? "✅ APROBADO" : "❌ REPROBADO"}
              </div>
            </div>
          </div>

          {/* Comentarios */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Comentario docente</label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={4}
              placeholder="Escribe aquí los comentarios de retroalimentación para la dupla..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
            />
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Estado de revisión</label>
            <div className="flex gap-2 flex-wrap">
              {(["revisado", "requiere_correccion"] as EstadoEntrega[]).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEstadoRevision(e)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${estadoRevision === e ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {e === "revisado" ? "✅ Revisado" : "🔁 Requiere corrección"}
                </button>
              ))}
            </div>
          </div>

          {/* Guardar */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!allScored || saving}
            className="w-full py-4 bg-gradient-to-r from-teal-600 to-cyan-700 text-white font-black rounded-2xl hover:from-teal-700 hover:to-cyan-800 shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed text-base"
          >
            {saving ? "Guardando..." : allScored ? "💾 Guardar revisión" : "Completa todos los puntajes para guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel principal docente ─────────────────────────────────────────────────
export default function PanelDocente() {
  const [entregas, setEntregas] = useState<EntregaConRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EntregaConRevision | null>(null);
  const [filtro, setFiltro] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoEntrega>("todos");

  const fetchEntregas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTodasLasEntregas();
      setEntregas(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntregas(); }, [fetchEntregas]);

  const filtered = entregas.filter((e) => {
    const q = filtro.toLowerCase();
    const matchText =
      e.dupla.estudiante1.toLowerCase().includes(q) ||
      e.dupla.estudiante2.toLowerCase().includes(q) ||
      (e.dupla.centroAtencion ?? "").toLowerCase().includes(q);
    const matchEstado = filtroEstado === "todos" || e.estado === filtroEstado;
    return matchText && matchEstado;
  });

  const estadoBadge = (estado: EstadoEntrega) => {
    if (estado === "revisado") return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">Revisado</span>;
    if (estado === "requiere_correccion") return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Req. corrección</span>;
    return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">Entregado</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800">📚 Pasantía 2º Año – Panel Docente</h1>
        <p className="text-slate-500 text-sm mt-1">Revisa, evalúa y califica las entregas de cada dupla.</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre de estudiante o centro..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
          className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
        >
          <option value="todos">Todos los estados</option>
          <option value="entregado">Entregado</option>
          <option value="revisado">Revisado</option>
          <option value="requiere_correccion">Requiere corrección</option>
        </select>
        <button onClick={fetchEntregas} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition">
          🔄 Actualizar
        </button>
      </div>

      {/* Contador */}
      <p className="text-xs text-slate-400">{filtered.length} entrega{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}</p>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <span className="text-4xl">📭</span>
          <p className="mt-3 text-sm">No hay entregas que coincidan con el filtro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const rev = e.revision;
            return (
              <div
                key={e.id}
                onClick={() => setSelected(e)}
                className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-teal-400 hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-slate-800 text-sm">{e.dupla.estudiante1}</span>
                    <span className="text-slate-300 text-xs">+</span>
                    <span className="font-black text-slate-800 text-sm">{e.dupla.estudiante2}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>📅 {new Date(e.enviadoEn ?? e.creadoEn).toLocaleDateString("es-CL")}</span>
                    {e.dupla.centroAtencion && <span>🏥 {e.dupla.centroAtencion}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {rev ? (
                    <>
                      <div className="text-right">
                        <p className={`text-2xl font-black ${rev.aprobado ? "text-green-600" : "text-red-600"}`}>{rev.notaFinal.toFixed(1)}</p>
                        <p className="text-xs text-slate-400">{rev.puntajeTotal}/30 pts</p>
                      </div>
                      {estadoBadge(e.estado)}
                    </>
                  ) : (
                    estadoBadge(e.estado)
                  )}
                  <span className="text-slate-300 text-lg">›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <ModalRevision
          entrega={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            fetchEntregas();
          }}
        />
      )}
    </div>
  );
}
