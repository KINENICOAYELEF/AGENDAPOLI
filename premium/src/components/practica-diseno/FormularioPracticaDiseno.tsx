"use client";

import { useState, useEffect, useCallback } from "react";
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

function Label({ required, children }: { required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
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
    // fallback plain text
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
  const STORAGE_KEY = "practica_diseno_borrador_v7";

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
          // Normalizar planIntervencion si venía en formato antiguo
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
      <div className="bg-slate-900 rounded-3xl p-8 text-white mb-8 shadow-xl">
        <h1 className="text-2xl md:text-3xl font-extrabold mb-2">
          Informe de Práctica: Diseño de Intervención
        </h1>
        <p className="text-slate-300 text-sm max-w-2xl">
          Formulario de entrega clínica enfocado en anamnesis, evaluaciones, matriz CIF, diagnóstico kinesiológico, objetivos priorizados, plan dosificado FITT-VP y pronóstico biopsicosocial.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* 1. Datos Identificación y Persona */}
        <SectionCard title="1. Datos generales de la persona atendida">
          <HelpText>
            Registren datos básicos que permitan entender quién es la persona y por qué fue atendida. No escriban información innecesaria ni datos sensibles que no aporten al caso.
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
              placeholder="Ej: Auxiliar de aseo, estudiante, jubilado/a, deportista recreativa..."
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
        <SectionCard title="2. Anamnesis / Entrevista clínica">
          <GuideBox title="¿Qué se espera en esta sección?">
            <p>Escriban la <strong>entrevista clínica completa</strong> que realizaron como tratantes. Incluyan anamnesis próxima (problema actual o motivo de ingreso) y remota (antecedentes). La anamnesis debe intentar responder:</p>
            <div className="mt-2 ml-2 space-y-0.5">
              {[
                "¿Cuál es el motivo principal o meta de salud que refiere la persona?",
                "¿Desde cuándo ocurre o cuál es su nivel de actividad física / condición previa?",
                "¿Cómo ha evolucionado su movilidad, independencia o sintomatología?",
                "¿Qué actividades le cuestan, quiere mantener o necesita mejorar?",
                "¿Qué factores facilitan o limitan su desempeño cotidiano?",
                "¿Ha tenido tratamientos o programas de ejercicio previos? ¿Cómo le fue?",
                "¿Qué antecedentes remotos relevantes tiene (enfermedades crónicas, caídas, cirugías)?",
                "¿Qué expectativas tiene con esta atención?",
              ].map((q) => (
                <p key={q} className="flex gap-2"><span className="text-blue-400 shrink-0">›</span> <span>{q}</span></p>
              ))}
            </div>
          </GuideBox>

          {/* Ejemplo desplegable */}
          <div className="border border-indigo-200 rounded-xl overflow-hidden mb-4">
            <button
              type="button"
              onClick={() => setShowAnamnesisExample(!showAnamnesisExample)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition text-sm font-semibold text-indigo-700"
            >
              <span>{showAnamnesisExample ? "Ocultar" : "Ver"} ejemplo de orden en anamnesis profesional</span>
              <span>{showAnamnesisExample ? "▲" : "▼"}</span>
            </button>
            {showAnamnesisExample && (
              <div className="px-4 py-4 bg-white text-xs text-slate-700 space-y-3 leading-relaxed border-t border-indigo-200">
                <p className="font-bold text-indigo-700">Ejemplo de estructura ordenada (próxima → remota):</p>
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
            placeholder="Registren aquí la entrevista clínica completa ordenada profesionalmente. Primero la anamnesis próxima (situación actual, funcionalidad, molestias o metas de salud). Luego la anamnesis remota (antecedentes médicos, comorbilidades, fármacos, caídas previas, hábitos y estilo de vida)..."
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
                placeholder="Analicen como tratantes: ¿Qué datos de la entrevista son los más relevantes clínicamente? ¿Qué hipótesis funcionales o de riesgo de declive funcional se forman? ¿Cuáles son las prioridades para la evaluación física?"
              />
            </div>
          </div>
        </SectionCard>

        {/* 3. Evaluaciones */}
        <SectionCard title="3. Evaluaciones realizadas por el tratante">
          <GuideBox title="¿Qué tipo de evaluaciones se esperan? (Criterio 3 de Rúbrica)">
            <p>Registren entre 2 y 4 evaluaciones pertinentes que aplicaron. Cada una debe incluir: nombre, justificación clínica de pertinencia, resultado obtenido (cuali-cuantitativo) e interpretación oportuna.</p>
            <p className="mt-1.5">Pueden ser pruebas de capacidad funcional, equilibrio (Romberg, Apoyo Unipodal, Timed Up and Go), fuerza muscular o dinamometría, movilidad articular, prueba de marcha (velocidad de marcha, 6 minutos), tolerancia al esfuerzo, dolor o escalas funcionales.</p>
          </GuideBox>

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
        <SectionCard title="4. Hallazgos principales del tratante">
          <GuideBox title="¿Qué poner aquí?">
            <p>Seleccionen <strong>solo los 3 datos más importantes</strong> que obtuvieron de la entrevista y la evaluación. No escriban todo. Elijan lo que realmente sintetiza el estado clínico-funcional del caso.</p>
          </GuideBox>
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
        <SectionCard title="5. Tabla CIF – Clasificación del caso">
          <GuideBox title="Guía para completar la CIF">
            <p>La CIF sirve para <strong>ordenar y clasificar el caso</strong>:</p>
            <div className="mt-2 bg-white border border-blue-200 rounded-lg p-3 space-y-1">
              <p><strong>Estructuras</strong> = ¿Qué parte del cuerpo está comprometida o evaluada? (tejidos físicos, articulaciones, masa muscular)</p>
              <p><strong>Funciones</strong> = ¿Qué capacidad fisiológica está alterada o disminuida? (fuerza, equilibrio, movilidad, dolor, resistencia)</p>
              <p><strong>Actividades</strong> = ¿Qué tareas o acciones concretas están limitadas o requieren entrenamiento? (marcha, escaleras, transferencias, alcanzar objetos)</p>
              <p><strong>Participación</strong> = ¿Cómo afecta o facilita sus roles vitales? (vida comunitaria, talleres, trabajo, recreación, hogar)</p>
              <p><strong>F. Personales</strong> = ¿Qué factores propios de la persona facilitan (+) o dificultan (-)? (edad, motivación, autoeficacia, hábitos)</p>
              <p><strong>F. Ambientales</strong> = ¿Qué del entorno físico y social ayuda (+) o dificulta (-)? (red de apoyo, barreras arquitectónicas, acceso)</p>
            </div>
          </GuideBox>

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
        <SectionCard title="6. Diagnóstico kinesiológico incipiente">
          <GuideBox title="¿Qué es un diagnóstico kinesiológico?">
            <p>Un diagnóstico kinesiológico es un <strong>texto integrador</strong> donde resumen y conectan: quién es la persona, qué situación funcional presenta, qué hallazgos arrojó la evaluación y qué factores contextuales influyen.</p>
          </GuideBox>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-xs text-indigo-900 space-y-4 mb-4">
            <p className="font-bold text-sm text-indigo-800">Estructura a seguir para la redacción diagnóstica:</p>
            <div className="space-y-3 bg-white border border-indigo-200 rounded-lg p-4 text-slate-700">
              <p><strong>1. Identificación y condición:</strong> Datos de la persona, ocupación, motivo de ingreso o condición de salud relevante.</p>
              <p><strong>2. Dimensión funcional y tareas:</strong> Dificultad o meta en actividades de la vida diaria y participación social/comunitaria.</p>
              <p><strong>3. Hallazgos del examen físico:</strong> Déficits en estructuras y funciones corporales evidenciados en la evaluación (con severidad).</p>
              <p><strong>4. Factores contextuales:</strong> Facilitadores y barreras personales y ambientales más influyentes.</p>
            </div>
          </div>

          <FieldTA
            label="Diagnóstico kinesiológico incipiente redactado por la dupla"
            value={caso.enunciadoDiagnostico}
            onChange={(v) => setCaso({ ...caso, enunciadoDiagnostico: v })}
            required
            rows={10}
            placeholder="Redacten su diagnóstico kinesiológico integrando: (1) Identificación y contexto, (2) Problemas o metas desde la persona, (3) Déficits estructurales/funcionales desde el tratante, y (4) Factores personales y ambientales..."
          />
        </SectionCard>

        {/* 7. Objetivos de Intervención Priorizados */}
        <SectionCard title="7. Objetivos de intervención (Priorizados por relevancia clínica)">
          {/* TABLA GUÍA PEDAGÓGICA EXTENDIDA DE VERBOS Y PARÁMETROS */}
          <div className="border border-teal-200 rounded-2xl overflow-hidden mb-5">
            <button
              type="button"
              onClick={() => setShowVerbosTable(!showVerbosTable)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-teal-50 hover:bg-teal-100 transition text-sm font-bold text-teal-800"
            >
              <span>{showVerbosTable ? "Ocultar" : "Ver"} Catálogo Completo: Verbos, Parámetros y Medición SMART</span>
              <span className="text-xs">{showVerbosTable ? "▲ Ocultar" : "▼ Desplegar Catálogo"}</span>
            </button>

            {showVerbosTable && (
              <div className="p-5 bg-white text-xs text-slate-700 space-y-4 border-t border-teal-200 overflow-x-auto">
                <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200">
                  <p className="font-bold text-teal-900 text-xs mb-1">
                    Fórmula de Redacción para Objetivos Específicos:
                  </p>
                  <p className="font-mono text-teal-800 font-semibold">
                    [Verbo en infinitivo] + [Parámetro/Variable fisiológica o motriz] + [Criterio de logro/Magnitud] + [Plazo o condición temporal]
                  </p>
                </div>

                <table className="w-full border-collapse border border-slate-200 text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold">
                      <th className="border border-slate-200 p-2.5">Dimensión CIF</th>
                      <th className="border border-slate-200 p-2.5">Verbos de Acción Sugeridos</th>
                      <th className="border border-slate-200 p-2.5">Parámetros / Variables Típicas</th>
                      <th className="border border-slate-200 p-2.5">Criterios de Logro / Medición SMART</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="border border-slate-200 p-2.5 font-bold text-teal-900 bg-teal-50/40">
                        Estructuras y Funciones Corporales
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        <ul className="list-disc list-inside space-y-0.5">
                          <li><strong>Dolor/Síntomas:</strong> Modular, mitigar, atenuar, desensibilizar.</li>
                          <li><strong>Movilidad:</strong> Incrementar, ganar, restablecer, ampliar, elongar.</li>
                          <li><strong>Fuerza:</strong> Aumentar, desarrollar, fortalecer, potenciar, reclutar.</li>
                          <li><strong>Control Motor:</strong> Optimizar, estabilizar, coordinar, reeducar.</li>
                          <li><strong>Capacidad Aeróbica:</strong> Acondicionar, mejorar resistencia.</li>
                        </ul>
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Dolor (EVA/EN), ROM activo/pasivo, Fuerza muscular (MRC / Dinamometría), Estabilidad lumbopélvica, Equilibrio estático unipodal, Flexibilidad miotendinosa, Tolerancia al esfuerzo.
                      </td>
                      <td className="border border-slate-200 p-2.5 italic text-slate-600">
                        Disminuir EVA a ≤ 2/10 en reposo; Incrementar ROM de flexión a +115°; Aumentar fuerza de cuádriceps a M4; Mantener apoyo unipodal &gt;20s sin oscilaciones, en 4 semanas.
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2.5 font-bold text-indigo-900 bg-indigo-50/40">
                        Actividades (Tareas Motoras y Funcionales)
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        <ul className="list-disc list-inside space-y-0.5">
                          <li><strong>Marcha:</strong> Reeducar, entrenar, prolongar, agilizar.</li>
                          <li><strong>Transferencias:</strong> Adquirir, ejecutar, independizar, lograr.</li>
                          <li><strong>Tareas complejas:</strong> Subir/bajar escaleras, agacharse, transportar.</li>
                          <li><strong>Prevención:</strong> Prevenir caídas, evitar compensaciones.</li>
                        </ul>
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Marcha continua (distancia/velocidad), Transferencia sedente-bípedo (test 30s), Subir escaleras alternando pies, Prueba Timed Up and Go (TUG), Agacharse a nivel de suelo, Destreza bimanual.
                      </td>
                      <td className="border border-slate-200 p-2.5 italic text-slate-600">
                        Caminar 500m continuos sin asistencia; Reducir tiempo en TUG a &lt;10s; Ejecutar 12 repeticiones en Chair Stand Test; Subir 1 piso de escaleras sin dolor limitante en 3 semanas.
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2.5 font-bold text-purple-900 bg-purple-50/40">
                        Participación (Roles Vitales y Comunidad)
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        <ul className="list-disc list-inside space-y-0.5">
                          <li><strong>Comunidad:</strong> Promover, facilitar, integrar, fomentar.</li>
                          <li><strong>Autonomía:</strong> Mantener independencia, favorecer autogestión.</li>
                          <li><strong>Rol Laboral/Hogar:</strong> Reintegrar, capacitar, fortalecer.</li>
                          <li><strong>Educación:</strong> Empoderar en adherencia y autocuidado.</li>
                        </ul>
                      </td>
                      <td className="border border-slate-200 p-2.5">
                        Asistencia a talleres de envejecimiento activo, Autonomía en compras/trámites vecinales, Desempeño de jornada laboral, Labores del hogar sin fatiga, Paseos recreativos familiares.
                      </td>
                      <td className="border border-slate-200 p-2.5 italic text-slate-600">
                        Participar 2 veces por semana de forma autónoma en el taller de actividad física comunitaria; Realizar compras semanales de forma independiente al término del ciclo.
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

              <div className="text-xs text-amber-950 space-y-1.5 leading-relaxed bg-white/80 p-3.5 rounded-xl border border-amber-200">
                <p className="font-bold text-amber-900">
                  ¿Cómo pensar el problema principal? (¡NO es solo el dolor ni el nombre médico!):
                </p>
                <p>
                  Un error habitual es escribir: <em>&quot;El problema principal es el dolor de rodilla&quot;</em> o <em>&quot;Tiene artrosis&quot;</em>. Eso es solo el síntoma o el diagnóstico biomédico.
                </p>
                <p>
                  En kinesiología el problema principal es el <strong>impacto funcional y biopsicosocial</strong> que esa condición genera en la vida de la persona: ¿Qué dejó de hacer? ¿Qué rol vital o autonomía cotidiana está amenazada? ¿Por qué acudió a kinesiología?
                </p>
                <p className="italic text-amber-800">
                  Ejemplo: &quot;Pérdida progresiva de la autonomía para trasladarse al paradero y realizar sus compras debido a fatiga muscular en miembros inferiores y temor a caídas en desniveles.&quot;
                </p>
              </div>

              <FieldTA
                label=""
                required
                rows={2}
                value={caso.objetivos.problemaPrincipal}
                onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, problemaPrincipal: v } })}
                placeholder="Redacten el problema principal identificando el impacto funcional y biopsicosocial en la persona..."
              />
            </div>

            {/* OBJETIVO GENERAL INTEGRADOR */}
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Label required>Objetivo General de Intervención</Label>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Meta Integradora
                </span>
              </div>

              <div className="text-xs text-emerald-950 bg-white/90 p-4 rounded-xl border border-emerald-200 space-y-2 leading-relaxed">
                <p className="font-bold text-emerald-900 text-xs">
                  ¿En qué se diferencia el Objetivo General de los Objetivos Específicos?:
                </p>
                <p>
                  El <strong>Objetivo General</strong> NO es un desglose de mediciones analíticas (eso va en los específicos). Es el <strong>propósito macro e integrador</strong> de la intervención: define la gran meta de control motor o capacidad funcional contextualizada en la actividad o rol real de la persona.
                </p>
                <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200/80 font-mono text-[11px] text-emerald-900">
                  <strong>Estructura sugerida:</strong> [Verbo integrador] + [Capacidad motriz o control motor global] + [Contexto o tarea funcional clave] + [para Actividad / Participación / Deporte / Vida diaria]
                </div>
                <div className="pt-1 text-[11px] text-emerald-900 space-y-1">
                  <p><strong>Ejemplos orientativos de Objetivo General:</strong></p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-700 italic pl-1">
                    <li><em>&quot;Optimizar el control unipodal dinámico de rodilla durante actividades de pivote para sus actividades deportivas.&quot;</em></li>
                    <li><em>&quot;Mejorar el equilibrio dinámico y la capacidad de marcha durante desplazamientos en desniveles para su autonomía en actividades de la comunidad.&quot;</em></li>
                    <li><em>&quot;Restablecer la tolerancia a la carga y la estabilidad lumbopélvica durante tareas de levantamiento para su desempeño laboral seguro.&quot;</em></li>
                  </ul>
                </div>
              </div>

              <FieldTA
                label=""
                required
                rows={3}
                value={caso.objetivos.objetivoGeneral}
                onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, objetivoGeneral: v } })}
                placeholder="Redacten el objetivo general integrador. Ej: Optimizar el control unipodal dinámico de rodilla durante actividades de pivote para sus actividades deportivas..."
              />
            </div>

            {/* OBJETIVOS ESPECÍFICOS PRIORIZADOS */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Objetivos Específicos Priorizados</h4>
                  <p className="text-xs text-slate-500">Ordenados de mayor a menor prioridad clínica para el caso.</p>
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
                      placeholder="Redacten el objetivo específico siguiendo la fórmula: [Verbo en infinitivo] + [Parámetro a intervenir] + [Criterio de logro/Medición] + [Plazo temporal]..."
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* 8. Plan de Intervención Dosificado FITT-VP */}
        <SectionCard title="8. Plan de intervención propuesto (Prescripción FITT-VP por Estrategia)">
          <GuideBox title="Metodología de prescripción kinésica FITT-VP (Criterio 5 de Rúbrica)">
            <p>
              Pueden proponer <strong>una o más estrategias de intervención por cada objetivo específico</strong>.
            </p>
            <p className="mt-1 font-semibold text-blue-900">
              Para cumplir plenamente la rúbrica (C5), asegúrense de que entre todas sus estrategias aborden las 3 dimensiones CIF:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  countFunciones > 0 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-slate-100 text-slate-500"
                }`}
              >
                Funciones/Estructuras: {countFunciones} estrategia(s)
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  countActividades > 0 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-slate-100 text-slate-500"
                }`}
              >
                Actividades: {countActividades} estrategia(s)
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  countParticipacion > 0 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-slate-100 text-slate-500"
                }`}
              >
                Participación: {countParticipacion} estrategia(s)
              </span>
            </div>
          </GuideBox>

          <div className="space-y-6">
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
        <SectionCard title="9. Pronóstico (incipiente) final y factores pronósticos">
          {/* GUÍA PEDAGÓGICA PARA CLASIFICAR EL PRONÓSTICO */}
          <GuideBox title="¿Cómo determinar si el pronóstico es Favorable, Reservado o Desfavorable?">
            <p>El pronóstico es la estimación clínica del potencial y tiempo de recuperación o mantenimiento funcional de la persona:</p>
            <div className="mt-2 space-y-2 text-slate-800">
              <div className="bg-white p-3 rounded-lg border border-green-200">
                <span className="font-bold text-green-700 uppercase tracking-wide">Pronóstico Favorable:</span>
                <p className="mt-0.5">El cuadro es tratable/entrenable con kinesiología; los factores protectores superan con claridad a las barreras; la persona tiene buena motivación y adherencia; no hay daño irreversible ni comorbilidades descompensadas. Se espera recuperación o ganancia sustancial de autonomía.</p>
              </div>

              <div className="bg-white p-3 rounded-lg border border-amber-200">
                <span className="font-bold text-amber-700 uppercase tracking-wide">Pronóstico Reservado / Relativo:</span>
                <p className="mt-0.5">Existe incertidumbre clínica; presencia de comorbilidades crónicas o cuadro de larga data (cronicidad); balance equilibrado entre facilitadores y barreras; o adherencia dudosa. Se espera mantenimiento o mejora parcial que requiere reevaluaciones periódicas.</p>
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
