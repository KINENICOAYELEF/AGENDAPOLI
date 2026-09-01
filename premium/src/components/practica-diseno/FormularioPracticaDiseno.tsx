"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { enviarEntregaDiseno } from "@/services/practica-diseno";
import { casoDisenoVacio, estrategiaFittVacio } from "@/types/practica-diseno";
import type {
  CasoDisenoIntervencion,
  DatosEstudianteDupla,
  EvaluacionDiseno,
  ObjetivoEspecificoItem,
  EstrategiaFittVP,
  CalificacionPronostico,
} from "@/types/practica-diseno";

function guid() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function HelpText({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
      {children}
    </div>
  );
}

function GuideBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1.5 leading-relaxed mb-4">
      <p className="font-bold text-sm text-blue-800 mb-1">{title}</p>
      {children}
    </div>
  );
}

function PedagogicalCallout({
  pregunta,
  errorComun,
  recurso,
}: {
  pregunta: string;
  errorComun: string;
  recurso?: string;
}) {
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-4 text-xs text-indigo-950 space-y-2">
      <div className="flex items-start gap-2">
        <span className="font-bold text-indigo-800 uppercase tracking-wider text-[10px] bg-indigo-100 px-2 py-0.5 rounded">
          Pregunta para Razonamiento Clínico:
        </span>
      </div>
      <p className="font-semibold text-slate-800">{pregunta}</p>
      <div className="bg-white/80 p-2.5 rounded-lg border border-indigo-100 space-y-1">
        <p className="text-rose-800 font-medium">
          <strong>Error habitual que debes evitar:</strong> {errorComun}
        </p>
        {recurso && <p className="text-indigo-800 italic">{recurso}</p>}
      </div>
    </div>
  );
}

function Label({ required, children }: { required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </div>
  );
}

function FieldTA({
  label,
  value,
  onChange,
  required,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-y placeholder:text-slate-400 min-h-[90px]"
      />
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition placeholder:text-slate-400"
      />
    </div>
  );
}

// ── CIF Componentes con Severidad ────────────────────────────
type Severidad = "" | "leve" | "moderado" | "severo" | "completo";

interface CifItem {
  id: string;
  texto: string;
  severidad: Severidad;
}

function serializeCifItems(items: CifItem[]): string {
  return JSON.stringify(items);
}

function parseCifItems(raw: string): CifItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) return parsed;
  } catch {
    // fallback
  }
  if (!raw.trim()) return [{ id: guid(), texto: "", severidad: "" }];
  return [{ id: guid(), texto: raw, severidad: "" }];
}

const SEVERIDADES: { val: Severidad; label: string; color: string }[] = [
  { val: "leve", label: "Leve", color: "bg-green-100 text-green-700 border-green-300" },
  { val: "moderado", label: "Moderado", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { val: "severo", label: "Severo", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { val: "completo", label: "Completo", color: "bg-red-100 text-red-700 border-red-300" },
];

function CifItemRow({
  item,
  onChange,
  onRemove,
  canRemove,
  placeholder,
  showSeveridad,
}: {
  item: CifItem;
  onChange: (updated: CifItem) => void;
  onRemove: () => void;
  canRemove: boolean;
  placeholder: string;
  showSeveridad: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-xl">
      <div className="flex gap-2">
        <input
          type="text"
          value={item.texto}
          onChange={(e) => onChange({ ...item, texto: e.target.value })}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none placeholder:text-slate-400"
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="px-2 text-red-400 hover:text-red-600 text-sm font-bold transition"
            title="Eliminar"
          >
            Eliminar
          </button>
        )}
      </div>
      {showSeveridad && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-400 self-center mr-1">Severidad:</span>
          {SEVERIDADES.map((s) => (
            <button
              key={s.val}
              type="button"
              onClick={() => onChange({ ...item, severidad: item.severidad === s.val ? "" : s.val })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                item.severidad === s.val
                  ? s.color
                  : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CifSection({
  title,
  subtitle,
  helpContent,
  items,
  onChange,
  placeholder,
  showSeveridad,
  maxItems,
}: {
  title: string;
  subtitle: string;
  helpContent: React.ReactNode;
  items: CifItem[];
  onChange: (newItems: CifItem[]) => void;
  placeholder: string;
  showSeveridad: boolean;
  maxItems?: number;
}) {
  const max = maxItems ?? 8;
  const update = (id: string, updated: CifItem) => onChange(items.map((i) => (i.id === id ? updated : i)));
  const remove = (id: string) => {
    if (items.length <= 1) return;
    onChange(items.filter((i) => i.id !== id));
  };
  const add = () => {
    if (items.length >= max) return;
    onChange([...items, { id: guid(), texto: "", severidad: "" }]);
  };

  return (
    <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
      <label className="block text-sm font-bold text-slate-700 mb-0.5">
        {title} <span className="text-red-500">*</span>
      </label>
      <p className="text-xs text-slate-500 italic mb-2">{subtitle}</p>
      <div className="mb-3">{helpContent}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <CifItemRow
            key={item.id}
            item={item}
            onChange={(u) => update(item.id, u)}
            onRemove={() => remove(item.id)}
            canRemove={items.length > 1}
            placeholder={placeholder}
            showSeveridad={showSeveridad}
          />
        ))}
      </div>
      {items.length < max && (
        <button
          type="button"
          onClick={add}
          className="mt-2 w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 text-xs font-semibold rounded-lg hover:bg-white hover:border-teal-300 hover:text-teal-600 transition"
        >
          + Agregar otro ({items.length}/{max})
        </button>
      )}
    </div>
  );
}

// ─── FORMULARIO PRINCIPAL ───────────────────────────────────────────────────
export default function FormularioPracticaDiseno() {
  const STORAGE_KEY = "practica_diseno_borrador_v8";

  const [dupla, setDupla] = useState<DatosEstudianteDupla>({
    estudiante1: "",
    estudiante2: "",
    fechaJornada: new Date().toISOString().split("T")[0],
    centroAtencion: "",
  });

  const [caso, setCaso] = useState<CasoDisenoIntervencion>(casoDisenoVacio());

  // Estados desplegables
  const [showAnamnesisExample, setShowAnamnesisExample] = useState(false);
  const [showVerbosTable, setShowVerbosTable] = useState(true);

  const [enviando, setEnviando] = useState(false);
  const [enviadoExito, setEnviadoExito] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Cargar borrador local
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dupla) setDupla(parsed.dupla);
        if (parsed.caso) {
          const c = parsed.caso;
          if (!c.planIntervencion?.estrategias || !Array.isArray(c.planIntervencion.estrategias)) {
            c.planIntervencion = {
              estrategias: [
                estrategiaFittVacio("Funciones y Estructuras"),
                estrategiaFittVacio("Actividades"),
                estrategiaFittVacio("Participación"),
              ],
            };
          }
          if (!c.objetivos?.problemaPrincipal) {
            c.objetivos = {
              problemaPrincipal: "",
              objetivoGeneral: c.objetivos?.objetivoGeneral || "",
              especificos: c.objetivos?.especificos || [
                { id: guid(), prioridad: 1, dimensionCIF: "Funciones y Estructuras", texto: "" },
              ],
            };
          }
          setCaso(c);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-guardar borrador
  const guardarBorrador = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dupla, caso }));
    } catch {
      // ignore
    }
  }, [dupla, caso]);

  useEffect(() => {
    const timer = setTimeout(guardarBorrador, 1000);
    return () => clearTimeout(timer);
  }, [dupla, caso, guardarBorrador]);

  // Manejo de evaluaciones
  const addEvaluacion = () => {
    if (caso.evaluaciones.length >= 4) return;
    setCaso((prev) => ({
      ...prev,
      evaluaciones: [
        ...prev.evaluaciones,
        { id: guid(), nombre: "", razon: "", resultado: "", interpretacion: "" },
      ],
    }));
  };

  const removeEvaluacion = (id: string) => {
    if (caso.evaluaciones.length <= 1) return;
    setCaso((prev) => ({
      ...prev,
      evaluaciones: prev.evaluaciones.filter((ev) => ev.id !== id),
    }));
  };

  const updateEvaluacion = (id: string, field: keyof EvaluacionDiseno, val: string) => {
    setCaso((prev) => ({
      ...prev,
      evaluaciones: prev.evaluaciones.map((ev) => (ev.id === id ? { ...ev, [field]: val } : ev)),
    }));
  };

  // Manejo de Objetivos Específicos Priorizados
  const addObjetivoEspecifico = () => {
    if (caso.objetivos.especificos.length >= 6) return;
    const nextPrioridad = caso.objetivos.especificos.length + 1;
    setCaso((prev) => ({
      ...prev,
      objetivos: {
        ...prev.objetivos,
        especificos: [
          ...prev.objetivos.especificos,
          { id: guid(), prioridad: nextPrioridad, dimensionCIF: "Actividades", texto: "" },
        ],
      },
    }));
  };

  const removeObjetivoEspecifico = (id: string) => {
    if (caso.objetivos.especificos.length <= 1) return;
    const filtered = caso.objetivos.especificos.filter((obj) => obj.id !== id);
    const reordered = filtered.map((obj, idx) => ({ ...obj, prioridad: idx + 1 }));
    setCaso((prev) => ({
      ...prev,
      objetivos: { ...prev.objetivos, especificos: reordered },
    }));
  };

  const updateObjetivoEspecifico = (id: string, field: keyof ObjetivoEspecificoItem, val: string | number) => {
    setCaso((prev) => ({
      ...prev,
      objetivos: {
        ...prev.objetivos,
        especificos: prev.objetivos.especificos.map((obj) => (obj.id === id ? { ...obj, [field]: val } : obj)),
      },
    }));
  };

  // Manejo Dinámico de Estrategias FITT-VP
  const addEstrategiaFitt = () => {
    if (caso.planIntervencion.estrategias.length >= 8) return;
    setCaso((prev) => ({
      ...prev,
      planIntervencion: {
        estrategias: [...prev.planIntervencion.estrategias, estrategiaFittVacio("Actividades")],
      },
    }));
  };

  const removeEstrategiaFitt = (id: string) => {
    if (caso.planIntervencion.estrategias.length <= 1) return;
    setCaso((prev) => ({
      ...prev,
      planIntervencion: {
        estrategias: prev.planIntervencion.estrategias.filter((est) => est.id !== id),
      },
    }));
  };

  const updateEstrategiaFitt = (id: string, field: keyof EstrategiaFittVP, val: string) => {
    setCaso((prev) => ({
      ...prev,
      planIntervencion: {
        estrategias: prev.planIntervencion.estrategias.map((est) =>
          est.id === id ? { ...est, [field]: val } : est
        ),
      },
    }));
  };

  // Helpers CIF
  const getCifItems = (key: keyof CasoDisenoIntervencion["cif"]) => parseCifItems(caso.cif[key]);
  const setCifItems = (key: keyof CasoDisenoIntervencion["cif"], items: CifItem[]) =>
    setCaso((prev) => ({ ...prev, cif: { ...prev.cif, [key]: serializeCifItems(items) } }));

  // Contador de dimensiones CIF en el plan de intervención
  const countFunciones = caso.planIntervencion.estrategias.filter(
    (e) => e.dimensionCIF === "Funciones y Estructuras"
  ).length;
  const countActividades = caso.planIntervencion.estrategias.filter(
    (e) => e.dimensionCIF === "Actividades"
  ).length;
  const countParticipacion = caso.planIntervencion.estrategias.filter(
    (e) => e.dimensionCIF === "Participación"
  ).length;

  // Semáforo de Coherencia Clínica (Auto-Chequeo en Vivo)
  const checklist = useMemo(() => {
    const hayPersona = !!caso.datosUsuaria.nombre.trim() && !!caso.datosUsuaria.motivoConsulta.trim();
    const hayAnamnesis = caso.anamnesis.length > 50 && caso.interpretacionAnamnesis.length > 30;
    const hayEvaluaciones = caso.evaluaciones.length >= 2 && caso.evaluaciones.every((e) => !!e.nombre && !!e.resultado);
    const hayDiagnostico = caso.enunciadoDiagnostico.length > 60;
    const hayProblemaYGeneral = !!caso.objetivos.problemaPrincipal.trim() && !!caso.objetivos.objetivoGeneral.trim();
    const hayEspecificos = caso.objetivos.especificos.length >= 2 && caso.objetivos.especificos.every((o) => !!o.texto.trim());
    const cubreCIF = countFunciones > 0 && countActividades > 0 && countParticipacion > 0;
    const hayPronostico = !!caso.pronostico.calificacion && !!caso.pronostico.factorPronostico1 && !!caso.pronostico.factorPronostico2 && !!caso.pronostico.factorPronostico3;

    const items = [
      { id: "persona", label: "Datos y Motivo Consulta", done: hayPersona },
      { id: "anamnesis", label: "Anamnesis & Análisis", done: hayAnamnesis },
      { id: "evaluaciones", label: "Evaluaciones (min. 2)", done: hayEvaluaciones },
      { id: "diag", label: "Diagnóstico Integrador", done: hayDiagnostico },
      { id: "objGen", label: "Problema & Obj. General", done: hayProblemaYGeneral },
      { id: "objEsp", label: "Obj. Específicos Priorizados", done: hayEspecificos },
      { id: "fitt", label: "Plan FITT-VP (3 Dim. CIF)", done: cubreCIF },
      { id: "pronostico", label: "Pronóstico & 3 Factores", done: hayPronostico },
    ];

    const completados = items.filter((i) => i.done).length;
    const porcentaje = Math.round((completados / items.length) * 100);

    return { items, completados, total: items.length, porcentaje };
  }, [caso, countFunciones, countActividades, countParticipacion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!dupla.estudiante1.trim()) {
      setErrorMsg("Debe ingresar al menos el nombre del Estudiante 1.");
      return;
    }

    if (!caso.datosUsuaria.nombre.trim() || !caso.enunciadoDiagnostico.trim()) {
      setErrorMsg("Por favor complete los datos básicos de la persona y el diagnóstico.");
      return;
    }

    if (!caso.objetivos.problemaPrincipal.trim() || !caso.objetivos.objetivoGeneral.trim()) {
      setErrorMsg("Debe declarar el Problema Kinesiológico Principal y el Objetivo General.");
      return;
    }

    const algunEspecificoVacio = caso.objetivos.especificos.some((obj) => !obj.texto.trim());
    if (caso.objetivos.especificos.length === 0 || algunEspecificoVacio) {
      setErrorMsg("Debe redactar el texto de todos los objetivos específicos priorizados.");
      return;
    }

    const algunaEstrategiaIncompleta = caso.planIntervencion.estrategias.some(
      (est) => !est.nombreEstrategia.trim() || !est.frecuencia.trim() || !est.intensidad.trim()
    );
    if (caso.planIntervencion.estrategias.length === 0 || algunaEstrategiaIncompleta) {
      setErrorMsg("Debe completar la técnica y parámetros FITT-VP para cada estrategia propuesta.");
      return;
    }

    if (!caso.pronostico.calificacion) {
      setErrorMsg("Debe seleccionar la clasificación del pronóstico (Favorable, Reservado o Desfavorable).");
      return;
    }

    if (
      !caso.pronostico.factorPronostico1.trim() ||
      !caso.pronostico.factorPronostico2.trim() ||
      !caso.pronostico.factorPronostico3.trim()
    ) {
      setErrorMsg("Debes declarar al menos 3 factores pronósticos en la sección de Pronóstico Incipiente.");
      return;
    }

    setEnviando(true);
    try {
      await enviarEntregaDiseno({
        estudiante: dupla,
        caso,
      });

      localStorage.removeItem(STORAGE_KEY);
      setEnviadoExito(true);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Ocurrió un error al enviar la práctica. Por favor intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviadoExito) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800">Informe de Práctica Enviado Exitosamente</h2>
        <p className="text-slate-600 text-sm leading-relaxed">
          Tu entrega de <strong>Práctica Diseño de Intervención</strong> ha sido registrada.
          El docente revisará tu informe con la pauta de evaluación.
        </p>
        <button
          type="button"
          onClick={() => {
            setEnviadoExito(false);
            setCaso(casoDisenoVacio());
          }}
          className="mt-4 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition"
        >
          Enviar otro informe
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white mb-6 shadow-xl">
        <h1 className="text-2xl md:text-3xl font-extrabold mb-2">
          Informe de Práctica: Diseño de Intervención
        </h1>
        <p className="text-slate-300 text-sm max-w-2xl">
          Módulo clínico interactivo: anamnesis, evaluaciones, matriz CIF, diagnóstico kinesiológico, objetivos por nivel, prescripción FITT-VP y pronóstico biopsicosocial.
        </p>
      </div>

      {/* Barra de Coherencia Clínica en Vivo (Andamiaje Pedagógico) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-8 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Auto-Chequeo de Coherencia Clínica ({checklist.completados}/{checklist.total} pasos)
            </span>
          </div>
          <span className="text-xs font-extrabold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
            {checklist.porcentaje}% Completitud
          </span>
        </div>

        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-500"
            style={{ width: `${checklist.porcentaje}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {checklist.items.map((it) => (
            <span
              key={it.id}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition ${
                it.done
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-slate-50 text-slate-400 border border-slate-200"
              }`}
            >
              {it.done ? "✓" : "○"} {it.label}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* 1. Datos Identificación y Persona */}
        <SectionCard
          title="1. Datos generales de la persona atendida"
          subtitle="Identificación y caracterización del usuario y su contexto"
        >
          <HelpText>
            Registren datos básicos que permitan entender quién es la persona y por qué fue atendida. Resguarden la confidencialidad usando iniciales o primer nombre.
          </HelpText>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput
              label="Estudiante 1"
              required
              value={dupla.estudiante1}
              onChange={(v) => setDupla({ ...dupla, estudiante1: v })}
              placeholder="Nombre y Apellido..."
            />
            <FieldInput
              label="Estudiante 2 (Opcional si es individual)"
              value={dupla.estudiante2 || ""}
              onChange={(v) => setDupla({ ...dupla, estudiante2: v })}
              placeholder="Nombre y Apellido..."
            />
            <FieldInput
              label="Fecha de la jornada"
              type="date"
              value={dupla.fechaJornada}
              onChange={(v) => setDupla({ ...dupla, fechaJornada: v })}
            />
            <FieldInput
              label="Centro de atención o institución"
              value={dupla.centroAtencion}
              onChange={(v) => setDupla({ ...dupla, centroAtencion: v })}
              placeholder="Ej: Polideportivo, CESFAM, centro comunitario..."
            />
          </div>

          <div className="border-t border-slate-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput
              label="Nombre o iniciales"
              required
              value={caso.datosUsuaria.nombre}
              onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, nombre: v } })}
              placeholder="Ej: M.G. o María G."
            />
            <FieldInput
              label="Edad"
              required
              value={caso.datosUsuaria.edad}
              onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, edad: v } })}
              placeholder="Ej: 68 años"
            />
            <FieldInput
              label="Ocupación o actividad principal"
              required
              value={caso.datosUsuaria.ocupacion}
              onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, ocupacion: v } })}
              placeholder="Ej: Auxiliar de aseo, jubilado/a, deportista recreativa, estudiante..."
            />
            <FieldInput
              label="Contexto de atención"
              required
              value={caso.datosUsuaria.contextoAtencion}
              onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, contextoAtencion: v } })}
              placeholder="Ej: Polideportivo (Envejecimiento Activo), CESFAM, ambulatorio..."
            />
          </div>

          <FieldTA
            label="Motivo principal de consulta o atención"
            required
            rows={3}
            value={caso.datosUsuaria.motivoConsulta}
            onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, motivoConsulta: v } })}
            placeholder="Describe el motivo según lo que la persona refiere. Ej: Ingreso a programa de ejercicio funcional y envejecimiento activo, dolor o molestia, prevención de caídas, acondicionamiento físico..."
          />
        </SectionCard>

        {/* 2. Anamnesis / Entrevista clínica */}
        <SectionCard
          title="2. Anamnesis / Entrevista clínica"
          subtitle="Recolección ordenada de información próxima y remota e interpretación del tratante"
        >
          <PedagogicalCallout
            pregunta="¿Tu anamnesis explica por qué la persona llegó a esta situación funcional y qué impacto tiene en su vida diaria?"
            errorComun="Limitarse a anotar síntomas aislados sin registrar el nivel previo de actividad física, caídas, hábitos ni la repercusión en sus roles vitales."
          />

          {/* Ejemplo desplegable */}
          <div className="border border-indigo-200 rounded-xl overflow-hidden mb-4">
            <button
              type="button"
              onClick={() => setShowAnamnesisExample(!showAnamnesisExample)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition text-sm font-semibold text-indigo-700"
            >
              <span>{showAnamnesisExample ? "Ocultar" : "Ver"} ejemplo de estructura ordenada (próxima → remota)</span>
              <span>{showAnamnesisExample ? "▲" : "▼"}</span>
            </button>
            {showAnamnesisExample && (
              <div className="px-4 py-4 bg-white text-xs text-slate-700 space-y-3 leading-relaxed border-t border-indigo-200">
                <div className="bg-slate-50 rounded-lg p-4 space-y-2.5 border border-slate-200">
                  <p><strong>Anamnesis próxima:</strong> Usuaria de 68 años, asiste a evaluación para plan de ejercicio funcional y envejecimiento activo. Refiere fatiga muscular en extremidades inferiores al caminar distancias mayores a 20 minutos y temor leve a caídas en desniveles. No relata caídas en el último semestre. Manifiesta alta motivación por mantener su autonomía y continuar asistiendo a sus talleres comunitarios.</p>
                  <p><strong>Anamnesis remota:</strong> Hipertensión arterial en tratamiento farmacológico con buen control. Sin antecedentes quirúrgicos recientes. Sedentaria en el hogar pero activa socialmente. Cuenta con buena red de apoyo familiar.</p>
                </div>
              </div>
            )}
          </div>

          <FieldTA
            label="Anamnesis próxima y remota realizada"
            value={caso.anamnesis}
            onChange={(v) => setCaso({ ...caso, anamnesis: v })}
            required
            rows={12}
            placeholder="Registren aquí la entrevista clínica completa ordenada profesionalmente: próxima (situación actual, funcionalidad, molestias o metas de salud) y remota (antecedentes médicos, comorbilidades, fármacos, caídas, hábitos)..."
          />

          <div className="border-t border-slate-200 pt-5">
            <GuideBox title="Interpretación de la anamnesis (análisis del tratante)">
              <p><strong>No repitan la anamnesis.</strong> Expliquen como tratantes: ¿qué datos son clínicamente más relevantes y qué prioridades funcionales o preventivas identifican?</p>
            </GuideBox>

            <div className="mt-4">
              <FieldTA
                label="Interpretación de la anamnesis"
                value={caso.interpretacionAnamnesis}
                onChange={(v) => setCaso({ ...caso, interpretacionAnamnesis: v })}
                required
                rows={5}
                placeholder="Analicen como tratantes: ¿Qué datos de la entrevista son los más relevantes clínicamente? ¿Qué hipótesis funcionales o de riesgo de declive funcional se forman? ¿Cuáles son las prioridades para el examen físico?"
              />
            </div>
          </div>
        </SectionCard>

        {/* 3. Evaluaciones */}
        <SectionCard
          title="3. Evaluaciones realizadas por el tratante"
          subtitle="Pruebas físicas y funcionales aplicadas con justificación e interpretación (Criterio 3)"
        >
          <PedagogicalCallout
            pregunta="¿Cada evaluación elegida aporta un dato objetivo que cambiará o guiará tu prescripción de ejercicio?"
            errorComun="Anotar valores numéricos sin explicar qué significan respecto a los valores normativos de la persona o su riesgo funcional."
          />

          <div className="space-y-5">
            {caso.evaluaciones.map((ev, idx) => (
              <div key={ev.id} className="border border-slate-200 rounded-xl p-5 bg-slate-50 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Evaluación {idx + 1}</span>
                  {caso.evaluaciones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEvaluacion(ev.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition font-medium"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <FieldInput
                    label="Nombre de la evaluación / test"
                    value={ev.nombre}
                    onChange={(v) => updateEvaluacion(ev.id, "nombre", v)}
                    required
                    placeholder="Ej: Timed Up and Go (TUG), Sentarse y Levantarse de la silla en 30s, Goniometría, EVA..."
                  />
                  <FieldTA
                    label="¿Por qué es pertinente realizar esta prueba? (Justificación)"
                    value={ev.razon}
                    onChange={(v) => updateEvaluacion(ev.id, "razon", v)}
                    required
                    rows={2}
                    placeholder="Justifiquen por qué esta prueba aporta información clave sobre la condición o funcionalidad de la persona..."
                  />
                  <FieldInput
                    label="Resultado obtenido"
                    value={ev.resultado}
                    onChange={(v) => updateEvaluacion(ev.id, "resultado", v)}
                    required
                    placeholder="Ej: 11.2 segundos en TUG / 12 repeticiones en 30 segundos / Rango activo 100°..."
                  />
                  <FieldTA
                    label="Interpretación oportuna del resultado"
                    value={ev.interpretacion}
                    onChange={(v) => updateEvaluacion(ev.id, "interpretacion", v)}
                    required
                    rows={2}
                    placeholder="¿Qué significa este valor respecto a los valores normativos de la persona, su autonomía o su riesgo funcional?"
                  />
                </div>
              </div>
            ))}
          </div>
          {caso.evaluaciones.length < 4 && (
            <button
              type="button"
              onClick={addEvaluacion}
              className="mt-3 w-full py-3 border-2 border-dashed border-teal-300 text-teal-600 font-semibold text-sm rounded-xl hover:bg-teal-50 transition"
            >
              + Agregar evaluación ({caso.evaluaciones.length}/4)
            </button>
          )}
        </SectionCard>

        {/* 4. Hallazgos principales */}
        <SectionCard
          title="4. Hallazgos principales del tratante"
          subtitle="Síntesis de los 3 datos más determinantes del caso"
        >
          <FieldTA
            label="Hallazgo 1 (el más relevante)"
            value={caso.hallazgo1}
            onChange={(v) => setCaso({ ...caso, hallazgo1: v })}
            required
            rows={2}
            placeholder="El hallazgo funcional o clínico prioritario..."
          />
          <FieldTA
            label="Hallazgo 2"
            value={caso.hallazgo2}
            onChange={(v) => setCaso({ ...caso, hallazgo2: v })}
            required
            rows={2}
            placeholder="Segundo hallazgo relevante..."
          />
          <FieldTA
            label="Hallazgo 3"
            value={caso.hallazgo3}
            onChange={(v) => setCaso({ ...caso, hallazgo3: v })}
            required
            rows={2}
            placeholder="Tercer hallazgo relevante..."
          />
        </SectionCard>

        {/* 5. Tabla CIF */}
        <SectionCard
          title="5. Tabla CIF – Clasificación del caso"
          subtitle="Mapeo estructurado en las 6 dimensiones de la CIF con gradación de severidad"
        >
          <div className="space-y-4">
            <CifSection
              title="A. Estructuras corporales"
              subtitle="¿Qué estructuras o sistemas anatómicos se relacionan con la condición?"
              helpContent={
                <HelpText>
                  Registren tejidos, articulaciones, musculatura, sistema articular o neuromuscular involucrado. No se usa severidad aquí.
                </HelpText>
              }
              items={getCifItems("estructurasCorporales")}
              onChange={(items) => setCifItems("estructurasCorporales", items)}
              placeholder="Ej: Musculatura de miembros inferiores, complejo articular..."
              showSeveridad={false}
            />

            <CifSection
              title="B. Funciones corporales alteradas o evaluadas"
              subtitle="¿Qué capacidades fisiológicas evaluaron y qué grado de alteración presentan?"
              helpContent={
                <HelpText>
                  Fuerza muscular, equilibrio estático/dinámico, movilidad articular, capacidad cardiorrespiratoria, dolor, propiocepción. <strong>Seleccionen la severidad</strong>.
                </HelpText>
              }
              items={getCifItems("funcionesCorporales")}
              onChange={(items) => setCifItems("funcionesCorporales", items)}
              placeholder="Ej: Equilibrio unipodal, fuerza muscular de cuádriceps, dolor..."
              showSeveridad={true}
            />

            <CifSection
              title="C. Actividades limitadas o a entrenar"
              subtitle="¿Qué tareas motoras o acciones concretas están comprometidas?"
              helpContent={
                <HelpText>
                  Marcha continua, subir/bajar escaleras, transferencias (sedente a bípedo), agacharse, alcance de objetos. <strong>Seleccionen la severidad</strong>.
                </HelpText>
              }
              items={getCifItems("actividades")}
              onChange={(items) => setCifItems("actividades", items)}
              placeholder="Ej: Subir escaleras, caminar distancias prolongadas, levantarse de silla..."
              showSeveridad={true}
            />

            <CifSection
              title="D. Restricción de participación"
              subtitle="¿En qué roles vitales, sociales o comunitarios se busca mantener o mejorar la integración?"
              helpContent={
                <HelpText>
                  Participación en talleres comunitarios/deportivos, autonomía en la vida diaria, rol laboral o familiar. <strong>Seleccionen la severidad</strong>.
                </HelpText>
              }
              items={getCifItems("participacion")}
              onChange={(items) => setCifItems("participacion", items)}
              placeholder="Ej: Participación en talleres de envejecimiento activo, autonomía en compras..."
              showSeveridad={true}
            />

            <CifSection
              title="E. Factores personales"
              subtitle="¿Qué factores propios de la persona influyen en su proceso?"
              helpContent={
                <HelpText>
                  Escriban si es facilitador (+) o barrera (-). Ej: (+) Alta motivación, adherencia | (-) Sedentarismo, temor a caerse.
                </HelpText>
              }
              items={getCifItems("factoresPersonales")}
              onChange={(items) => setCifItems("factoresPersonales", items)}
              placeholder="Ej: (+) Alta motivación por participar en el programa"
              showSeveridad={false}
            />

            <CifSection
              title="F. Factores ambientales"
              subtitle="¿Qué factores del entorno físico o social influyen?"
              helpContent={
                <HelpText>
                  Escriban si es facilitador (+) o barrera (-). Ej: (+) Apoyo familiar, acceso a centro deportivo | (-) Escaleras sin pasamanos.
                </HelpText>
              }
              items={getCifItems("factoresAmbientales")}
              onChange={(items) => setCifItems("factoresAmbientales", items)}
              placeholder="Ej: (+) Red de apoyo social y acceso a recinto deportivo"
              showSeveridad={false}
            />
          </div>
        </SectionCard>

        {/* 6. Diagnóstico Kinesiológico */}
        <SectionCard
          title="6. Diagnóstico kinesiológico incipiente"
          subtitle="Enunciado clínico integrador que articula persona, función, déficits y contexto"
        >
          <PedagogicalCallout
            pregunta="Si otra persona lee tu diagnóstico sin ver el nombre, ¿puede entender exactamente qué le pasa a este usuario único y por qué necesita kinesiología?"
            errorComun="Escribir solo un diagnóstico médico (ej. 'Gonartrosis derecha') en vez de integrar la situación funcional y biopsicosocial de la persona."
          />

          <FieldTA
            label="Diagnóstico kinesiológico incipiente redactado por la dupla"
            value={caso.enunciadoDiagnostico}
            onChange={(v) => setCaso({ ...caso, enunciadoDiagnostico: v })}
            required
            rows={10}
            placeholder="Redacten su diagnóstico kinesiológico integrando: (1) Identificación y contexto, (2) Problemas o metas desde la persona, (3) Déficits estructurales/funcionales desde el tratante, y (4) Factores personales y ambientales..."
          />
        </SectionCard>

        {/* 7. Objetivos de Intervención: General vs Específicos */}
        <SectionCard
          title="7. Objetivos de intervención (Diferenciación General vs Específicos)"
          subtitle="Articulación jerárquica: Propósito global de participación e hitos operacionales priorizados (Criterio 4)"
        >
          {/* COMPARATIVA PEDAGÓGICA CLAVE: GENERAL VS ESPECÍFICOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2 text-xs text-emerald-950">
              <span className="font-bold text-emerald-900 uppercase tracking-wider text-[11px] bg-emerald-100 px-2 py-0.5 rounded">
                Objetivo General = El Fin Último (Participación / Autonomía)
              </span>
              <p className="leading-relaxed">
                Define el <strong>gran propósito de egreso o alta funcional</strong>. No se enreda en medir grados ni repeticiones musculares; responde a: <em>¿Para qué atendemos a esta persona en su totalidad?</em>
              </p>
              <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200 font-mono text-[11px] text-emerald-900">
                [Verbo de impacto global: Favorecer, Restablecer, Promover, Optimizar, Mantener] + [Nivel de Autonomía/Capacidad Global] + <strong>[Rol vital / Participación comunitaria / AVD]</strong> + [Plazo global]
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2 text-xs text-indigo-950">
              <span className="font-bold text-indigo-900 uppercase tracking-wider text-[11px] bg-indigo-100 px-2 py-0.5 rounded">
                Objetivos Específicos = Hitos Operacionales Medibles
              </span>
              <p className="leading-relaxed">
                Son los <strong>pasos técnicos intermedios</strong> que resuelven las deficiencias biomecánicas y tareas motoras necesarias para que el objetivo general se haga realidad.
              </p>
              <div className="bg-white/80 p-2.5 rounded-lg border border-indigo-200 font-mono text-[11px] text-indigo-900">
                [Verbo de acción técnica] + [Parámetro fisiológico / Tarea motriz] + <strong>[Criterio de logro cuantitativo SMART]</strong> + [Plazo]
              </div>
            </div>
          </div>

          {/* TABLA GUÍA PEDAGÓGICA EXTENDIDA */}
          <div className="border border-teal-200 rounded-2xl overflow-hidden mb-5">
            <button
              type="button"
              onClick={() => setShowVerbosTable(!showVerbosTable)}
              className="w-full flex items-center justify-between px-5 py-3 bg-teal-50 hover:bg-teal-100 transition text-xs font-bold text-teal-800"
            >
              <span>{showVerbosTable ? "Ocultar" : "Ver"} Catálogo Completo de Verbos y Parámetros por Dimensión CIF</span>
              <span>{showVerbosTable ? "▲ Ocultar" : "▼ Desplegar"}</span>
            </button>

            {showVerbosTable && (
              <div className="p-4 bg-white text-xs text-slate-700 space-y-3 border-t border-teal-200 overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold">
                      <th className="border border-slate-200 p-2.5">Dimensión CIF</th>
                      <th className="border border-slate-200 p-2.5">Verbos de Acción Sugeridos</th>
                      <th className="border border-slate-200 p-2.5">Parámetros / Variables Típicas</th>
                      <th className="border border-slate-200 p-2.5">Criterios de Medición SMART</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="border border-slate-200 p-2.5 font-bold text-teal-900 bg-teal-50/40">
                        Estructuras y Funciones
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Modular, Incrementar, Optimizar, Disminuir, Ganar, Desarrollar, Acondicionar, Estabilizar.
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Dolor (EVA), ROM activo, Fuerza muscular (MRC), Control motor dinámico, Equilibrio estático, Flexibilidad.
                      </td>
                      <td className="border border-slate-200 p-2.5 italic text-slate-600">
                        Disminuir EVA a ≤ 2/10; Ganar +20° de flexión; Fuerza cuádriceps M4; Apoyo unipodal &gt;20s en 4 semanas.
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2.5 font-bold text-indigo-900 bg-indigo-50/40">
                        Actividades (Tareas Motoras)
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Reeducar, Entrenar, Lograr, Ejecutar, Adquirir, Mejorar, Transferir, Prevenir caídas.
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Marcha continua, Transferencias sedente-bípedo (Chair Stand Test), Subir/bajar escaleras, TUG, Agacharse.
                      </td>
                      <td className="border border-slate-200 p-2.5 italic text-slate-600">
                        Caminar 500m continuos; Reducir TUG a &lt;10s; 12 repeticiones en Chair Stand Test; Subir 1 piso alternando pies.
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2.5 font-bold text-purple-900 bg-purple-50/40">
                        Participación (Roles / Autonomía)
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Promover, Facilitar, Integrar, Fomentar, Mantener, Capacitar, Reintegrar, Empoderar.
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Asistencia a talleres de envejecimiento activo, Autonomía en compras/trámites, Desempeño laboral, Tareas del hogar.
                      </td>
                      <td className="border border-slate-200 p-2.5 italic text-slate-600">
                        Participar 2 veces/sem en talleres comunitarios de forma autónoma y segura al término del ciclo de sesiones.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {/* GUÍA PEDAGÓGICA PARA EL PROBLEMA PRINCIPAL */}
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label required>Problema Kinesiológico Principal a Resolver</Label>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Enfoque Biopsicosocial
                </span>
              </div>

              <div className="text-xs text-amber-950 space-y-1.5 leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-200">
                <p className="font-bold text-amber-900">
                  ¿Cómo pensar el problema principal? (¡NO es solo el dolor ni el nombre de la patología!):
                </p>
                <p>
                  El dolor o el daño tisular son solo síntomas. El problema kinesiológico principal es el <strong>impacto en la capacidad funcional y en la vida real de la persona</strong> (¿Qué autonomía o rol vital está amenazado?).
                </p>
              </div>

              <FieldTA
                label=""
                required
                rows={2}
                value={caso.objetivos.problemaPrincipal}
                onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, problemaPrincipal: v } })}
                placeholder="Ej: Pérdida progresiva de la autonomía para trasladarse al paradero y realizar sus compras debido a fatiga muscular en miembros inferiores y temor a caídas en desniveles..."
              />
            </div>

            {/* OBJETIVO GENERAL */}
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 space-y-2.5">
              <Label required>Objetivo General de Intervención (Propósito Global de Participación)</Label>
              <FieldTA
                label=""
                required
                rows={3}
                value={caso.objetivos.objetivoGeneral}
                onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, objetivoGeneral: v } })}
                placeholder="Ej: Favorecer la autonomía funcional e independencia en la marcha comunitaria de la usuaria, permitiendo su participación activa y segura en los talleres de envejecimiento activo al término de 6 semanas de intervención kinésica..."
              />
            </div>

            {/* OBJETIVOS ESPECÍFICOS PRIORIZADOS */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Objetivos Específicos Priorizados</h4>
                  <p className="text-xs text-slate-500">Hitos intermedios ordenados por relevancia clínica para alcanzar el Objetivo General.</p>
                </div>
                {caso.objetivos.especificos.length < 6 && (
                  <button
                    type="button"
                    onClick={addObjetivoEspecifico}
                    className="text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-lg transition"
                  >
                    + Agregar objetivo específico
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {caso.objetivos.especificos.map((obj, idx) => (
                  <div key={obj.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-teal-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                          Prioridad {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-700">Dimensión CIF:</span>
                        <select
                          value={obj.dimensionCIF}
                          onChange={(e) => updateObjetivoEspecifico(obj.id, "dimensionCIF", e.target.value)}
                          className="text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 outline-none bg-white"
                        >
                          <option value="Funciones y Estructuras">Funciones y Estructuras</option>
                          <option value="Actividades">Actividades (Tareas Motoras)</option>
                          <option value="Participación">Participación (Roles / Comunidad)</option>
                        </select>
                      </div>

                      {caso.objetivos.especificos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeObjetivoEspecifico(obj.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold self-end sm:self-auto"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    <FieldTA
                      label={`Redacción del Objetivo Específico #${idx + 1}`}
                      required
                      rows={2}
                      value={obj.texto}
                      onChange={(v) => updateObjetivoEspecifico(obj.id, "texto", v)}
                      placeholder="Fórmula: [Verbo en infinitivo] + [Parámetro a intervenir] + [Criterio de logro medible SMART] + [Plazo temporal]..."
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* 8. Plan de Intervención Dosificado FITT-VP */}
        <SectionCard
          title="8. Plan de intervención propuesto (Prescripción FITT-VP por Estrategia)"
          subtitle="Diseño de intervenciones concretas vinculadas a objetivos y dosificadas rigurosamente (Criterio 5)"
        >
          <PedagogicalCallout
            pregunta="Si le entregas esta pauta a otro colega kinesiólogo, ¿podría ejecutarla con los mismos parámetros exactos sin tener que inventar la carga ni la progresión?"
            errorComun="Escribir solo 'ejercicios de fuerza 3 series' sin especificar la intensidad (Borg/kg), el tipo de contracción ni el criterio objetivo de progresión."
          />

          {/* Monitor de Cobertura CIF */}
          <div className="bg-slate-100 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Cobertura de Dimensiones CIF en el Plan:</span>
            <div className="flex flex-wrap gap-2">
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  countFunciones > 0 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-white text-slate-400 border border-slate-200"
                }`}
              >
                Funciones/Estructuras: {countFunciones}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  countActividades > 0 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-white text-slate-400 border border-slate-200"
                }`}
              >
                Actividades: {countActividades}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  countParticipacion > 0 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-white text-slate-400 border border-slate-200"
                }`}
              >
                Participación: {countParticipacion}
              </span>
            </div>
          </div>

          <div className="space-y-6 pt-2">
            {caso.planIntervencion.estrategias.map((est, idx) => (
              <div key={est.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-4 relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-900 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                      Estrategia #{idx + 1}
                    </span>
                    <select
                      value={est.dimensionCIF}
                      onChange={(e) => updateEstrategiaFitt(est.id, "dimensionCIF", e.target.value)}
                      className="text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 outline-none bg-white"
                    >
                      <option value="Funciones y Estructuras">Funciones y Estructuras</option>
                      <option value="Actividades">Actividades (Tareas Motoras)</option>
                      <option value="Participación">Participación (Roles y Entorno)</option>
                    </select>
                  </div>

                  {caso.planIntervencion.estrategias.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEstrategiaFitt(est.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold self-end sm:self-auto"
                    >
                      Eliminar estrategia
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldInput
                    label="Nombre de la Técnica / Modalidad terapéutica"
                    required
                    value={est.nombreEstrategia}
                    onChange={(v) => updateEstrategiaFitt(est.id, "nombreEstrategia", v)}
                    placeholder="Ej: Ejercicio de fuerza en cuádriceps, entrenamiento de transferencias, educación ergonómica..."
                  />

                  <div>
                    <Label required>¿A qué Objetivo Específico tributa?</Label>
                    <select
                      value={est.objetivoRelacionado}
                      onChange={(e) => updateEstrategiaFitt(est.id, "objetivoRelacionado", e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                    >
                      <option value="">Selecciona objetivo relacionado...</option>
                      {caso.objetivos.especificos.map((obj, i) => (
                        <option key={obj.id} value={`Objetivo #${i + 1}: ${obj.texto.slice(0, 40)}...`}>
                          Prioridad #{i + 1} ({obj.dimensionCIF})
                        </option>
                      ))}
                      <option value="Objetivo General">Al Objetivo General</option>
                      <option value="Varios objetivos">A múltiples objetivos específicos</option>
                    </select>
                  </div>
                </div>

                {/* Dosificación FITT-VP */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block">
                    Parámetros de Dosificación FITT-VP:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <FieldInput
                      label="F · Frecuencia"
                      required
                      value={est.frecuencia}
                      onChange={(v) => updateEstrategiaFitt(est.id, "frecuencia", v)}
                      placeholder="Ej: 3 días/semana, 1 vez al día"
                    />
                    <FieldInput
                      label="I · Intensidad"
                      required
                      value={est.intensidad}
                      onChange={(v) => updateEstrategiaFitt(est.id, "intensidad", v)}
                      placeholder="Ej: RPE 5-6 en escala Borg / 60% 1RM"
                    />
                    <FieldInput
                      label="T · Tiempo / Duración"
                      required
                      value={est.tiempo}
                      onChange={(v) => updateEstrategiaFitt(est.id, "tiempo", v)}
                      placeholder="Ej: 30 minutos de sesión / 45s de trabajo"
                    />
                    <FieldInput
                      label="T · Tipo de estímulo"
                      required
                      value={est.tipo}
                      onChange={(v) => updateEstrategiaFitt(est.id, "tipo", v)}
                      placeholder="Ej: Dinámico en cadena cerrada, aeróbico, circuito"
                    />
                    <FieldInput
                      label="V · Volumen"
                      required
                      value={est.volumen}
                      onChange={(v) => updateEstrategiaFitt(est.id, "volumen", v)}
                      placeholder="Ej: 3 series de 10 reps, 60s descanso"
                    />
                    <FieldInput
                      label="P · Progresión y Criterio de Avance"
                      required
                      value={est.progresion}
                      onChange={(v) => updateEstrategiaFitt(est.id, "progresion", v)}
                      placeholder="Ej: Aumentar 1 serie al tolerar con RPE < 5; detener si EVA > 4"
                    />
                  </div>
                </div>
              </div>
            ))}

            {caso.planIntervencion.estrategias.length < 8 && (
              <button
                type="button"
                onClick={addEstrategiaFitt}
                className="w-full py-3.5 border-2 border-dashed border-teal-300 text-teal-700 font-bold text-sm rounded-2xl hover:bg-teal-50 transition"
              >
                + Agregar otra Estrategia de Intervención ({caso.planIntervencion.estrategias.length}/8)
              </button>
            )}
          </div>
        </SectionCard>

        {/* 9. Pronóstico Incipiente */}
        <SectionCard
          title="9. Pronóstico (incipiente) final y factores pronósticos"
          subtitle="Estimación clínica fundamentada de la evolución funcional y declaración de 3 factores (Criterio 6)"
        >
          <PedagogicalCallout
            pregunta="¿Tu pronóstico se basa únicamente en la estructura biológica o toma en cuenta si la persona vive sola, si tiene kinesiofobia o si su red de apoyo colabora?"
            errorComun="Clasificar el pronóstico sin fundamentar el porqué o declarar factores vagos que no diferencian si son facilitadores (+) o barreras (-)."
          />

          {/* GUÍA PEDAGÓGICA PARA CLASIFICAR EL PRONÓSTICO */}
          <GuideBox title="¿Cómo determinar si el pronóstico es Favorable, Reservado o Desfavorable?">
            <div className="space-y-2 text-slate-800">
              <div className="bg-white p-3 rounded-lg border border-green-200">
                <span className="font-bold text-green-700 uppercase tracking-wide">Pronóstico Favorable:</span>
                <p className="mt-0.5">El cuadro es tratable/entrenable con kinesiología; los factores protectores superan a las barreras; alta motivación y adherencia; sin daño irreversible ni comorbilidades descompensadas. Se espera recuperación o ganancia sustancial de autonomía.</p>
              </div>

              <div className="bg-white p-3 rounded-lg border border-amber-200">
                <span className="font-bold text-amber-700 uppercase tracking-wide">Pronóstico Reservado / Relativo:</span>
                <p className="mt-0.5">Existe incertidumbre clínica; presencia de comorbilidades crónicas o cuadro de larga data; balance equilibrado entre facilitadores y barreras; o adherencia dudosa. Se espera mantenimiento o mejora parcial con reevaluaciones frecuentes.</p>
              </div>

              <div className="bg-white p-3 rounded-lg border border-red-200">
                <span className="font-bold text-red-700 uppercase tracking-wide">Pronóstico Desfavorable:</span>
                <p className="mt-0.5">Condición degenerativa severa o irreversible; predominio de barreras ambientales/personales insalvables; alto riesgo de declive funcional severo. Los objetivos se orientan al confort, educación y prevención de complicaciones secundarias.</p>
              </div>
            </div>
          </GuideBox>

          {/* Selector de Clasificación */}
          <div className="space-y-2 mb-4">
            <Label required>Clasificación del Pronóstico Kinesiológico:</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { val: "favorable", label: "Favorable", color: "bg-emerald-600 border-emerald-600 text-white" },
                { val: "reservado", label: "Reservado / Relativo", color: "bg-amber-600 border-amber-600 text-white" },
                { val: "desfavorable", label: "Desfavorable", color: "bg-rose-600 border-rose-600 text-white" },
              ].map((p) => {
                const active = caso.pronostico.calificacion === p.val;
                return (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() =>
                      setCaso({
                        ...caso,
                        pronostico: { ...caso.pronostico, calificacion: p.val as CalificacionPronostico },
                      })
                    }
                    className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      active ? p.color : "bg-slate-50 border-slate-300 text-slate-700 hover:border-teal-400"
                    }`}
                  >
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <FieldTA
            label="Fundamentación clínica del pronóstico"
            required
            rows={4}
            value={caso.pronostico.fundamentacion}
            onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, fundamentacion: v } })}
            placeholder="Fundamenten por qué clasificaron el pronóstico en esa categoría: analicen la adaptabilidad tisular/neuromuscular, respuesta previa, comorbilidades y reserva funcional de la persona..."
          />

          <FieldTA
            label="Relación con el diagnóstico e intervención propuesta"
            required
            rows={3}
            value={caso.pronostico.relacionDiagnosticoEIntervencion}
            onChange={(v) =>
              setCaso({ ...caso, pronostico: { ...caso.pronostico, relacionDiagnosticoEIntervencion: v } })
            }
            placeholder="Expliquen de qué manera el plan de intervención propuesto hace viable el pronóstico a partir del diagnóstico inicial..."
          />

          <div className="pt-2">
            <Label required>Declaración de Factores Pronósticos (Obligatorio declarar 3):</Label>
            <p className="text-xs text-slate-500 mb-3">Identifiquen al menos 3 factores biopsicosociales concretos (indicar si es [+] Facilitador o [-] Barrera).</p>
            <div className="space-y-3">
              <FieldInput
                label="Factor Pronóstico 1"
                required
                value={caso.pronostico.factorPronostico1}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico1: v } })}
                placeholder="Ej: Factor conductual / personal (+): Alta adherencia a los talleres y motivación por el ejercicio..."
              />
              <FieldInput
                label="Factor Pronóstico 2"
                required
                value={caso.pronostico.factorPronostico2}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico2: v } })}
                placeholder="Ej: Factor ambiental / físico (-): Presencia de escaleras sin pasamanos en su trayecto habitual..."
              />
              <FieldInput
                label="Factor Pronóstico 3"
                required
                value={caso.pronostico.factorPronostico3}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico3: v } })}
                placeholder="Ej: Factor clínico / biológico (+): Buena capacidad funcional previa y ausencia de comorbilidades agudas..."
              />
            </div>
          </div>
        </SectionCard>

        {/* Error */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Botón de Enviar */}
        <div className="flex items-center justify-end gap-4 pb-12">
          <button
            type="submit"
            disabled={enviando}
            className="px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition disabled:opacity-50 flex items-center gap-2"
          >
            {enviando ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando práctica...
              </>
            ) : (
              <span>Enviar Informe de Práctica</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
