"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getTodasLasEntregasDiseno,
  guardarRevisionDocenteDiseno,
} from "@/services/practica-diseno";
import { calcularNotaDiseno } from "@/types/practica-diseno";
import type {
  EntregaDisenoConRevision,
  CasoDisenoIntervencion,
  RevisionDocenteDiseno,
  PuntajesCriteriosDiseno,
  EstadoEntregaDiseno,
} from "@/types/practica-diseno";

// ── Criterios Exactos de la Rúbrica Oficial (28 Puntos Totales) ─────────────
interface CriterioConfig {
  key: keyof PuntajesCriteriosDiseno;
  categoria: string;
  label: string;
  desc: string;
  max: number;
  options: { val: number; label: string }[];
}

const CRITERIOS_DISENO: CriterioConfig[] = [
  {
    key: "c1",
    categoria: "Aspectos Generales Individuales",
    label: "C1 · Requerimientos Formales Solicitados desde la Institución",
    desc: "Cumple con los requerimientos formales: responsabilidad, puntualidad, uso de uniforme institucional y respeto por las normas de la institución.",
    max: 5,
    options: [
      { val: 1, label: "1 pt (0/4): No cumple con los requerimientos formales solicitados." },
      { val: 2, label: "2 pts (1/4): Cumple con uno (1/4) de los requerimientos formales." },
      { val: 3, label: "3 pts (2/4): Cumple con dos (2/4) de los requerimientos formales." },
      { val: 4, label: "4 pts (3/4): Cumple con tres (3/4) de los requerimientos formales." },
      { val: 5, label: "5 pts (4/4): Cumple con todos los requerimientos formales (responsabilidad, puntualidad, uniforme, respeto a normas)." },
    ],
  },
  {
    key: "c2",
    categoria: "Aspectos Generales Individuales",
    label: "C2 · Actitud, Trato Empático y Confidencialidad",
    desc: "Mostrar proactividad en su formación, manejo empático de la relación usuario-tratante, uso de lenguaje formal acorde y resguardo riguroso de la confidencialidad.",
    max: 5,
    options: [
      { val: 1, label: "1 pt (0/4): No demuestra proactividad, ni relación empática, ni lenguaje formal, ni resguardo de confidencialidad." },
      { val: 2, label: "2 pts (1/4): Demuestra uno (1/4) de los componentes requeridos." },
      { val: 3, label: "3 pts (2/4): Demuestra dos (2/4) de los componentes requeridos." },
      { val: 4, label: "4 pts (3/4): Demuestra tres (3/4) de los componentes requeridos." },
      { val: 5, label: "5 pts (4/4): Demuestra proactividad, empatía y respeto, lenguaje formal y resguardo riguroso de confidencialidad." },
    ],
  },
  {
    key: "c3",
    categoria: "Aspectos de Manejo Clínico Grupales",
    label: "C3 · Evaluaciones Desarrolladas en el Proceso",
    desc: "Las evaluaciones desarrolladas en el proceso son pertinentes, las ejecuta correctamente y los resultados los logra interpretar de manera correcta y oportuna.",
    max: 5,
    options: [
      { val: 1, label: "1 pt (0/4): No son pertinentes, no se ejecutan correctamente, no logra interpretar resultados de manera correcta ni oportuna." },
      { val: 2, label: "2 pts (1/4): Consideran 1 de 4 elementos (pertinencia, correcta ejecución, interpretación correcta, tiempo oportuno)." },
      { val: 3, label: "3 pts (2/4): Consideran 2 de 4 elementos." },
      { val: 4, label: "4 pts (3/4): Consideran 3 de 4 elementos." },
      { val: 5, label: "5 pts (4/4): Consideran los 4/4 elementos a cabalidad (pertinentes, correcta ejecución, interpretación correcta y oportuna)." },
    ],
  },
  {
    key: "c4",
    categoria: "Aspectos de Manejo Clínico Grupales",
    label: "C4 · Objetivos de Intervención (Dimensiones CIF)",
    desc: "Los objetivos se relacionan con el enunciado diagnóstico (clínico o situacional), son alcanzables, y plantean objetivo general y objetivos específicos acordes a dimensiones CIF.",
    max: 5,
    options: [
      { val: 1, label: "1 pt (0/4): No se relacionan con el diagnóstico, no son alcanzables y son incoherentes con dimensiones CIF." },
      { val: 2, label: "2 pts (1/4): Se relacionan con 1 de los 4 componentes (relación con diagnóstico, alcanzables, objetivo general, específicos acordes a CIF)." },
      { val: 3, label: "3 pts (2/4): Se relacionan con 2 de los 4 componentes." },
      { val: 4, label: "4 pts (3/4): Se relacionan con 3 de los 4 componentes." },
      { val: 5, label: "5 pts (4/4): Se relacionan con los 4 componentes requeridos a cabalidad." },
    ],
  },
  {
    key: "c5",
    categoria: "Aspectos de Manejo Clínico Grupales",
    label: "C5 · Plan de Intervención Propuesto (Estrategias CIF)",
    desc: "El plan de intervención propuesto es coherente con objetivos propuestos y considera al menos una estrategia de intervención para cada dimensión CIF.",
    max: 3,
    options: [
      { val: 1, label: "1 pt: No es coherente con objetivos propuestos y no considera estrategias para cada dimensión CIF." },
      { val: 2, label: "2 pts: Es coherente con objetivos propuestos O considera al menos una estrategia para cada dimensión CIF." },
      { val: 3, label: "3 pts: Es coherente con objetivos propuestos Y considera al menos una estrategia de intervención para cada dimensión CIF." },
    ],
  },
  {
    key: "c6",
    categoria: "Aspectos de Manejo Clínico Grupales",
    label: "C6 · Pronóstico (Incipiente) Final y Factores Pronósticos",
    desc: "El pronóstico final es fundamentado y se relaciona con diagnóstico e intervención propuesta. Consideran al menos 3 factores pronósticos.",
    max: 5,
    options: [
      { val: 1, label: "1 pt (0/4): No es fundamentado, no se relaciona con diagnóstico ni con intervención, y no considera factores pronósticos." },
      { val: 2, label: "2 pts (1/4): Considera 1 de las 4 características (fundamentado, relación con diagnóstico, relación con intervención, al menos 3 factores)." },
      { val: 3, label: "3 pts (2/4): Considera 2 de las 4 características." },
      { val: 4, label: "4 pts (3/4): Considera 3 de las 4 características." },
      { val: 5, label: "5 pts (4/4): Cumple las 4 características (fundamentado, coherente con diagnóstico/intervención y declara al menos 3 factores pronósticos)." },
    ],
  },
];

function ScoreSelector({
  criterio,
  value,
  onChange,
}: {
  criterio: CriterioConfig;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{criterio.categoria}</span>
        <span className="text-xs font-extrabold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
          Máx: {criterio.max} pts
        </span>
      </div>
      <h4 className="font-bold text-slate-800 text-sm mb-1">{criterio.label}</h4>
      <p className="text-xs text-slate-500 mb-3 leading-relaxed">{criterio.desc}</p>

      <div className="space-y-2">
        {criterio.options.map((opt) => {
          const active = value === opt.val;
          return (
            <button
              key={opt.val}
              type="button"
              onClick={() => onChange(opt.val)}
              className={`w-full p-2.5 rounded-xl text-xs font-medium border transition text-left flex items-start gap-2.5 ${
                active
                  ? "bg-teal-600 border-teal-600 text-white shadow-md font-semibold"
                  : "bg-white border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-800"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5 ${
                  active ? "bg-white text-teal-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {opt.val}
              </span>
              <span className="leading-snug">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Componente CIF Row ──────────────────────────────────────────────────────
const SEV_COLORS: Record<string, string> = {
  leve: "bg-green-100 text-green-700",
  moderado: "bg-amber-100 text-amber-700",
  severo: "bg-orange-100 text-orange-700",
  completo: "bg-red-100 text-red-700",
};

function CifRow({ label, value }: { label: string; value: string }) {
  let items: { texto: string; severidad?: string }[] = [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].texto !== undefined) {
      items = parsed.filter((i: { texto: string }) => i.texto.trim());
    }
  } catch {
    // plain text
  }

  return (
    <div className="border-b border-slate-100 py-2">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-white text-slate-700 text-xs px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm"
            >
              {item.texto}
              {item.severidad && (
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    SEV_COLORS[item.severidad] || "bg-slate-200 text-slate-500"
                  }`}
                >
                  {item.severidad}
                </span>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-wrap">
          {value || <span className="text-slate-400 italic">Sin especificar</span>}
        </p>
      )}
    </div>
  );
}

// ── Vista Detallada del Caso Estudiantil ───────────────────────────────────
function VistaCasoDiseno({ caso }: { caso: CasoDisenoIntervencion }) {
  return (
    <div className="space-y-6 text-sm text-slate-700">
      {/* 1. Datos Persona */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">1. Datos de la Persona</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <p><strong>Nombre:</strong> {caso.datosUsuaria.nombre}</p>
          <p><strong>Edad:</strong> {caso.datosUsuaria.edad}</p>
          <p><strong>Ocupación:</strong> {caso.datosUsuaria.ocupacion}</p>
          <p><strong>Contexto:</strong> {caso.datosUsuaria.contextoAtencion}</p>
        </div>
        <div className="mt-2 bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
          <strong>Motivo Consulta:</strong> {caso.datosUsuaria.motivoConsulta}
        </div>
      </div>

      {/* 2. Anamnesis e Interpretación */}
      <div className="space-y-2">
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">2. Anamnesis e Interpretación</h4>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs whitespace-pre-wrap">
          <p className="font-semibold text-slate-700 mb-1">Anamnesis próxima y remota:</p>
          {caso.anamnesis}
        </div>
        <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 text-xs text-blue-900 whitespace-pre-wrap">
          <p className="font-semibold text-blue-800 mb-1">Interpretación de la anamnesis:</p>
          {caso.interpretacionAnamnesis}
        </div>
      </div>

      {/* 3. Evaluaciones (Para Criterio C3) */}
      <div>
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
          3. Evaluaciones Clínicas ({caso.evaluaciones.length}) — Relevante para C3
        </h4>
        <div className="space-y-2">
          {caso.evaluaciones.map((ev, idx) => (
            <div key={ev.id} className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-800">{idx + 1}. {ev.nombre || "Sin nombre"}</p>
              <p className="text-slate-600"><strong>Justificación clínica (Pertinencia):</strong> {ev.razon}</p>
              <p className="text-slate-600"><strong>Resultado obtenido (Ejecución):</strong> {ev.resultado}</p>
              <p className="text-teal-900 bg-teal-50 p-2 rounded-lg border border-teal-100">
                <strong>Interpretación oportuna:</strong> {ev.interpretacion}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Hallazgos */}
      <div>
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
          4. Hallazgos Principales
        </h4>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
          <p><strong>1.</strong> {caso.hallazgo1}</p>
          <p><strong>2.</strong> {caso.hallazgo2}</p>
          <p><strong>3.</strong> {caso.hallazgo3}</p>
        </div>
      </div>

      {/* 5. Matriz CIF */}
      <div>
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">5. Clasificación CIF</h4>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
          <CifRow label="Estructuras Corporales" value={caso.cif.estructurasCorporales} />
          <CifRow label="Funciones Corporales" value={caso.cif.funcionesCorporales} />
          <CifRow label="Actividades" value={caso.cif.actividades} />
          <CifRow label="Participación" value={caso.cif.participacion} />
          <CifRow label="Factores Personales" value={caso.cif.factoresPersonales} />
          <CifRow label="Factores Ambientales" value={caso.cif.factoresAmbientales} />
        </div>
      </div>

      {/* 6. Diagnóstico */}
      <div className="space-y-2">
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">6. Diagnóstico Kinesiológico Incipiente</h4>
        <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 text-xs text-indigo-900 whitespace-pre-wrap">
          {caso.enunciadoDiagnostico}
        </div>
      </div>

      {/* 7. Objetivos CIF (Para Criterio C4) */}
      <div className="space-y-2">
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
          7. Objetivos de Intervención — Relevante para C4
        </h4>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-2.5">
          <div>
            <span className="font-bold uppercase text-[10px] text-emerald-800 tracking-wider">Objetivo General:</span>
            <p className="mt-0.5">{caso.objetivos.objetivoGeneral}</p>
          </div>
          <hr className="border-emerald-200" />
          <div>
            <span className="font-bold uppercase text-[10px] text-emerald-800 tracking-wider">Esp. Estructuras y Funciones:</span>
            <p className="mt-0.5">{caso.objetivos.estructurasFunciones}</p>
          </div>
          <div>
            <span className="font-bold uppercase text-[10px] text-emerald-800 tracking-wider">Esp. Actividades:</span>
            <p className="mt-0.5">{caso.objetivos.actividades}</p>
          </div>
          <div>
            <span className="font-bold uppercase text-[10px] text-emerald-800 tracking-wider">Esp. Participación:</span>
            <p className="mt-0.5">{caso.objetivos.participacion}</p>
          </div>
        </div>
      </div>

      {/* 8. Plan de Intervención (Para Criterio C5) */}
      <div>
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
          8. Plan de Intervención (Estrategias CIF) — Relevante para C5
        </h4>
        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2.5">
          <div>
            <span className="font-bold uppercase text-[10px] text-amber-800 tracking-wider">Estrategias Estructuras/Funciones (Técnicas + FITT):</span>
            <p className="mt-0.5 whitespace-pre-wrap">{caso.planIntervencion.estructurasFunciones}</p>
          </div>
          <hr className="border-amber-200" />
          <div>
            <span className="font-bold uppercase text-[10px] text-amber-800 tracking-wider">Estrategias Actividades (Entrenamiento de Tareas):</span>
            <p className="mt-0.5 whitespace-pre-wrap">{caso.planIntervencion.actividades}</p>
          </div>
          <hr className="border-amber-200" />
          <div>
            <span className="font-bold uppercase text-[10px] text-amber-800 tracking-wider">Estrategias Participación (Ergonomía / Familia / Domicilio):</span>
            <p className="mt-0.5 whitespace-pre-wrap">{caso.planIntervencion.participacion}</p>
          </div>
        </div>
      </div>

      {/* 9. Pronóstico Incipiente (Para Criterio C6) */}
      <div>
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
          9. Pronóstico Incipiente Final — Relevante para C6
        </h4>
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 text-xs text-purple-900 space-y-2.5">
          <div>
            <span className="font-bold uppercase text-[10px] text-purple-800 tracking-wider">Fundamentación Fisiopatológica/Funcional:</span>
            <p className="mt-0.5 whitespace-pre-wrap">{caso.pronostico.fundamentacion}</p>
          </div>
          <div>
            <span className="font-bold uppercase text-[10px] text-purple-800 tracking-wider">Relación con Diagnóstico e Intervención:</span>
            <p className="mt-0.5 whitespace-pre-wrap">{caso.pronostico.relacionDiagnosticoEIntervencion}</p>
          </div>
          <div className="pt-1">
            <span className="font-bold uppercase text-[10px] text-purple-800 tracking-wider">Factores Pronósticos Declarados (Mínimo 3):</span>
            <ul className="list-disc list-inside mt-1 space-y-1 text-purple-900 font-medium">
              <li>{caso.pronostico.factorPronostico1}</li>
              <li>{caso.pronostico.factorPronostico2}</li>
              <li>{caso.pronostico.factorPronostico3}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PANEL PRINCIPAL DOCENTE ──────────────────────────────────────────────────
export default function PanelDocenteDiseno() {
  const [entregas, setEntregas] = useState<EntregaDisenoConRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Estado de evaluación para la entrega seleccionada (6 criterios de la rúbrica)
  const [puntajes, setPuntajes] = useState<PuntajesCriteriosDiseno>({
    c1: 5,
    c2: 5,
    c3: 5,
    c4: 5,
    c5: 3,
    c6: 5,
  });
  const [comentarioDocente, setComentarioDocente] = useState("");
  const [estadoRevision, setEstadoRevision] = useState<EstadoEntregaDiseno>("revisado");
  const [guardando, setGuardando] = useState(false);
  const [exitoGuardar, setExitoGuardar] = useState(false);

  const cargarEntregas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTodasLasEntregasDiseno();
      setEntregas(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    cargarEntregas();
  }, [cargarEntregas]);

  const entregaSeleccionada = entregas.find((e) => e.id === selectedId);

  useEffect(() => {
    if (entregaSeleccionada?.revision) {
      setPuntajes(entregaSeleccionada.revision.puntajes);
      setComentarioDocente(entregaSeleccionada.revision.comentarioDocente || "");
      setEstadoRevision(entregaSeleccionada.revision.estadoRevision || "revisado");
    } else {
      setPuntajes({ c1: 5, c2: 5, c3: 5, c4: 5, c5: 3, c6: 5 });
      setComentarioDocente("");
      setEstadoRevision("revisado");
    }
  }, [entregaSeleccionada]);

  // Cálculo en tiempo real de notas sobre 28 pts con umbral 60%
  const puntajeTotal = puntajes.c1 + puntajes.c2 + puntajes.c3 + puntajes.c4 + puntajes.c5 + puntajes.c6;
  const { nota, porcentaje, aprobado } = calcularNotaDiseno(puntajeTotal);

  const handleGuardarRevision = async () => {
    if (!selectedId) return;
    setGuardando(true);
    setExitoGuardar(false);

    try {
      const revision: RevisionDocenteDiseno = {
        puntajes,
        comentarioDocente,
        notaFinal: nota,
        puntajeTotal,
        porcentaje,
        aprobado,
        revisadoEn: new Date().toISOString(),
        estadoRevision,
      };

      await guardarRevisionDocenteDiseno(selectedId, revision);
      setExitoGuardar(true);
      await cargarEntregas();
      setTimeout(() => setExitoGuardar(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Error al guardar la revisión.");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Cargando entregas de Práctica Diseño...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header Docente */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 rounded-3xl p-6 text-white mb-8 shadow-xl">
        <div>
          <div className="inline-block bg-teal-500/30 text-teal-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
            Panel de Evaluación Docente
          </div>
          <h1 className="text-2xl font-extrabold">Práctica: Diseño de Intervención</h1>
          <p className="text-slate-400 text-xs mt-1">
            Rúbrica de 28 Puntos (Escala de Exigencia 60% — Nota 4.0 con 16.8 puntos).
          </p>
        </div>
        <button
          type="button"
          onClick={cargarEntregas}
          className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
        >
          Actualizar Entregas ({entregas.length})
        </button>
      </div>

      {entregas.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto">
          <h3 className="text-lg font-bold text-slate-800 mb-1">No hay entregas registradas aún</h3>
          <p className="text-slate-500 text-xs leading-relaxed">
            Las entregas enviadas por los estudiantes a través del formulario de Práctica Diseño aparecerán aquí para su revisión.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Lista de Entregas (Columna Izquierda) */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="font-bold text-slate-800 text-sm px-1">Entregas de Estudiantes</h3>
            <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
              {entregas.map((item) => {
                const isSelected = item.id === selectedId;
                const tieneRevision = !!item.revision;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id || null)}
                    className={`w-full text-left p-4 rounded-2xl border transition ${
                      isSelected
                        ? "bg-teal-50 border-teal-500 shadow-md ring-2 ring-teal-500/20"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800 text-sm truncate">
                        {item.estudiante.estudiante1}
                      </span>
                      {tieneRevision ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Nota {item.revision?.notaFinal}
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Pendiente
                        </span>
                      )}
                    </div>
                    {item.estudiante.estudiante2 && (
                      <p className="text-xs text-slate-500 mb-1 truncate">
                        Dupla con: {item.estudiante.estudiante2}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                      <span>{item.estudiante.centroAtencion || "Sin centro"}</span>
                      <span>
                        {item.enviadoEn ? new Date(item.enviadoEn).toLocaleDateString() : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Área de Revisión y Caso (Columna Derecha) */}
          {entregaSeleccionada && (
            <div className="lg:col-span-8 space-y-6">
              {/* Tarjeta de Resumen de Nota */}
              <div className="bg-gradient-to-r from-slate-900 to-teal-900 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg font-extrabold">{entregaSeleccionada.estudiante.estudiante1}</h3>
                  {entregaSeleccionada.estudiante.estudiante2 && (
                    <p className="text-xs text-teal-200">Dupla: {entregaSeleccionada.estudiante.estudiante2}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    Centro: {entregaSeleccionada.estudiante.centroAtencion || "Polideportivo"}
                  </p>
                </div>

                <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10">
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">Puntaje Total</p>
                    <p className="text-2xl font-black">{puntajeTotal} <span className="text-sm font-normal text-slate-300">/ 28</span></p>
                  </div>
                  <div className="h-8 w-px bg-white/20" />
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">Porcentaje</p>
                    <p className="text-2xl font-black">{porcentaje}%</p>
                  </div>
                  <div className="h-8 w-px bg-white/20" />
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">Nota Final</p>
                    <p className={`text-3xl font-black ${aprobado ? "text-emerald-400" : "text-rose-400"}`}>
                      {nota.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rúbrica de Evaluación Docente */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-800">
                    Rúbrica de Evaluación (28 Puntos Totales)
                  </h3>
                  <span className="text-xs text-slate-500 font-semibold">
                    Escala 60% (16.8 pts = 4.0)
                  </span>
                </div>

                <div>
                  {CRITERIOS_DISENO.map((crit) => (
                    <ScoreSelector
                      key={crit.key}
                      criterio={crit}
                      value={puntajes[crit.key]}
                      onChange={(val) => setPuntajes({ ...puntajes, [crit.key]: val })}
                    />
                  ))}
                </div>

                {/* Comentario Docente */}
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">
                    Retroalimentación Pedagógica Docente
                  </label>
                  <textarea
                    rows={4}
                    value={comentarioDocente}
                    onChange={(e) => setComentarioDocente(e.target.value)}
                    placeholder="Escribe comentarios pedagógicos sobre la coherencia del diagnóstico, la formulación de objetivos CIF, la dosificación de las estrategias o el pronóstico..."
                    className="w-full p-4 border border-slate-300 rounded-2xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                {/* Estado de la Revisión */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-700">Estado de entrega:</span>
                    <select
                      value={estadoRevision}
                      onChange={(e) => setEstadoRevision(e.target.value as EstadoEntregaDiseno)}
                      className="text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none bg-slate-50"
                    >
                      <option value="revisado">Revisado / Evaluado</option>
                      <option value="requiere_correccion">Requiere Corrección</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleGuardarRevision}
                    disabled={guardando}
                    className="w-full sm:w-auto px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {guardando ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <span>Guardar Calificación</span>
                    )}
                  </button>
                </div>

                {exitoGuardar && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold text-center">
                    Evaluación guardada exitosamente.
                  </div>
                )}
              </div>

              {/* Detalle del Informe Entregado por el Estudiante */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-800 border-b border-slate-200 pb-3">
                  Informe Entregado por el Estudiante / Dupla
                </h3>

                <VistaCasoDiseno caso={entregaSeleccionada.caso} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
