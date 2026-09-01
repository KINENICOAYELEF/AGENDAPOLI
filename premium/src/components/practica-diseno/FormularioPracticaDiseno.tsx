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
      {label && <Label required={required}>{label}</Label>}
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
  const STORAGE_KEY = "practica_diseno_borrador_v9";

  const [dupla, setDupla] = useState<DatosEstudianteDupla>({
    estudiante1: "",
    estudiante2: "",
    fechaJornada: new Date().toISOString().split("T")[0],
    centroAtencion: "",
  });

  const [caso, setCaso] = useState<CasoDisenoIntervencion>(casoDisenoVacio());

  // Estados colapsables
  const [showAnamnesisExample, setShowAnamnesisExample] = useState(false);
  const [showDiferenciaGeneral, setShowDiferenciaGeneral] = useState(false);
  const [showVerbosTable, setShowVerbosTable] = useState(false);
  const [showGuiaPriorizacion, setShowGuiaPriorizacion] = useState(false);

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
                estrategiaFittVacio(),
              ],
            };
          }
          if (!c.objetivos?.problemaPrincipal) {
            c.objetivos = {
              problemaPrincipal: "",
              objetivoGeneral: c.objetivos?.objetivoGeneral || "",
              especificos: c.objetivos?.especificos || [
                { id: guid(), prioridad: 1, texto: "" },
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

  // Manejo de Objetivos Específicos Priorizados (Sin selector de dimensión)
  const addObjetivoEspecifico = () => {
    if (caso.objetivos.especificos.length >= 6) return;
    const nextPrioridad = caso.objetivos.especificos.length + 1;
    setCaso((prev) => ({
      ...prev,
      objetivos: {
        ...prev.objetivos,
        especificos: [
          ...prev.objetivos.especificos,
          { id: guid(), prioridad: nextPrioridad, texto: "" },
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

  const updateObjetivoEspecifico = (id: string, texto: string) => {
    setCaso((prev) => ({
      ...prev,
      objetivos: {
        ...prev.objetivos,
        especificos: prev.objetivos.especificos.map((obj) => (obj.id === id ? { ...obj, texto } : obj)),
      },
    }));
  };

  // Manejo Dinámico de Estrategias FITT-VP
  const addEstrategiaFitt = () => {
    if (caso.planIntervencion.estrategias.length >= 8) return;
    setCaso((prev) => ({
      ...prev,
      planIntervencion: {
        estrategias: [...prev.planIntervencion.estrategias, estrategiaFittVacio()],
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

  // Alternar selección de objetivo relacionado en una estrategia
  const toggleObjetivoRelacionado = (estId: string, objTag: string) => {
    const est = caso.planIntervencion.estrategias.find((e) => e.id === estId);
    if (!est) return;

    let list = est.objetivoRelacionado
      ? est.objetivoRelacionado.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    if (list.includes(objTag)) {
      list = list.filter((item) => item !== objTag);
    } else {
      list.push(objTag);
    }

    const nuevaRelacion = list.join(", ");
    setCaso((prev) => ({
      ...prev,
      planIntervencion: {
        estrategias: prev.planIntervencion.estrategias.map((item) => {
          if (item.id !== estId) return item;
          return {
            ...item,
            objetivoRelacionado: nuevaRelacion,
          };
        }),
      },
    }));
  };

  // Helpers CIF
  const getCifItems = (key: keyof CasoDisenoIntervencion["cif"]) => parseCifItems(caso.cif[key]);
  const setCifItems = (key: keyof CasoDisenoIntervencion["cif"], items: CifItem[]) =>
    setCaso((prev) => ({ ...prev, cif: { ...prev.cif, [key]: serializeCifItems(items) } }));

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
            rows={10}
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
                rows={4}
                placeholder="Analicen como tratantes: ¿Qué datos de la entrevista son los más relevantes clínicamente? ¿Qué hipótesis funcionales o de riesgo de declive funcional se forman? ¿Cuáles son las prioridades para la evaluación física?"
              />
            </div>
          </div>
        </SectionCard>

        {/* 3. Evaluaciones */}
        <SectionCard title="3. Evaluaciones realizadas por el tratante">
          <GuideBox title="¿Qué tipo de evaluaciones se esperan?">
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
            rows={8}
            placeholder="Redacten su diagnóstico kinesiológico integrando: (1) Identificación y contexto, (2) Problemas o metas desde la persona, (3) Déficits estructurales/funcionales desde el tratante, y (4) Factores personales y ambientales..."
          />
        </SectionCard>

        {/* 7. Objetivos de Intervención Priorizados */}
        <SectionCard title="7. Objetivos de intervención">
          {/* ACORDEÓN 1: GUÍA DE DIFERENCIACIÓN GENERAL VS ESPECÍFICOS */}
          <div className="border border-emerald-200 rounded-2xl overflow-hidden mb-3">
            <button
              type="button"
              onClick={() => setShowDiferenciaGeneral(!showDiferenciaGeneral)}
              className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 hover:bg-emerald-100 transition text-xs font-bold text-emerald-800"
            >
              <span>{showDiferenciaGeneral ? "Ocultar" : "Ver"} Guía: ¿En qué se diferencia el Objetivo General de los Específicos?</span>
              <span>{showDiferenciaGeneral ? "▲" : "▼"}</span>
            </button>

            {showDiferenciaGeneral && (
              <div className="p-4 bg-white text-xs text-slate-700 space-y-3 border-t border-emerald-200 leading-relaxed">
                <p>
                  El <strong>Objetivo General</strong> es el <strong>propósito macro e integrador</strong>: sintetiza la capacidad motriz o funcional global en el contexto de la actividad real de la persona. <strong>No debe redactarse como un objetivo analítico con micro-mediciones</strong> (eso corresponde a los específicos).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-red-50 p-2.5 rounded-lg border border-red-200 text-red-900">
                    <p className="font-bold mb-1">Qué NO poner en el Objetivo General (Errores comunes):</p>
                    <ul className="list-disc list-inside space-y-0.5 text-red-800">
                      <li>&quot;Aumentar fuerza de cuádriceps de M3 a M4 en 4 semanas&quot; <em>(Es un específico analítico)</em></li>
                      <li>&quot;Disminuir dolor de 6/10 a 2/10 en 2 semanas&quot; <em>(Es un específico analítico)</em></li>
                      <li>&quot;Ganar 20° de flexión de rodilla&quot; <em>(Es un específico analítico)</em></li>
                    </ul>
                  </div>

                  <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 text-emerald-900">
                    <p className="font-bold mb-1">Qué SÍ poner (Meta Funcional Integradora):</p>
                    <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
                      <li>&quot;Optimizar el control unipodal dinámico de rodilla durante actividades de pivote para sus actividades deportivas.&quot;</li>
                      <li>&quot;Mejorar la estabilidad postural y marcha en desniveles para su autonomía en la comunidad.&quot;</li>
                      <li>&quot;Restablecer la tolerancia a la carga y control lumbopélvico en levantamiento de peso para su rol laboral.&quot;</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-200/80 font-mono text-[11px] text-emerald-900">
                  <strong>Estructura del General:</strong> [Verbo integrador] + [Capacidad motriz o control motor global] + [Contexto o tarea funcional clave] + [para Actividad / Participación / Deporte / Vida diaria]
                </div>
              </div>
            )}
          </div>

          {/* ACORDEÓN 2: TABLA GUÍA DESGLOSADA PASO A PASO PARA ARMAR OBJETIVOS */}
          <div className="border border-teal-200 rounded-2xl overflow-hidden mb-3">
            <button
              type="button"
              onClick={() => setShowVerbosTable(!showVerbosTable)}
              className="w-full flex items-center justify-between px-4 py-3 bg-teal-50 hover:bg-teal-100 transition text-xs font-bold text-teal-800"
            >
              <span>{showVerbosTable ? "Ocultar" : "Ver"} Tabla Guía Desglosada: Cómo Construir Objetivos Paso a Paso</span>
              <span>{showVerbosTable ? "▲" : "▼"}</span>
            </button>

            {showVerbosTable && (
              <div className="p-4 bg-white text-xs text-slate-700 space-y-3 border-t border-teal-200 overflow-x-auto">
                <p className="text-slate-600">
                  Sigan las 4 columnas para armar la oración de cada objetivo específico:
                </p>

                <table className="w-full border-collapse border border-slate-200 text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold">
                      <th className="border border-slate-200 p-2">Enfoque</th>
                      <th className="border border-slate-200 p-2">1. Verbo de Acción</th>
                      <th className="border border-slate-200 p-2">2. Parámetro Funcional</th>
                      <th className="border border-slate-200 p-2">3. Criterio / Medición</th>
                      <th className="border border-slate-200 p-2">4. Plazo / Condición</th>
                      <th className="border border-slate-200 p-2 bg-slate-200/60">Ejemplo Completo Armado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="border border-slate-200 p-2 font-bold text-teal-900 bg-teal-50/40">
                        Dolor / Síntomas
                      </td>
                      <td className="border border-slate-200 p-2">Modular / Mitigar / Atenuar</td>
                      <td className="border border-slate-200 p-2">el dolor patelofemoral anterior</td>
                      <td className="border border-slate-200 p-2">a EVA ≤ 2/10 en reposo y carga</td>
                      <td className="border border-slate-200 p-2">en un plazo de 2 semanas.</td>
                      <td className="border border-slate-200 p-2 italic text-slate-800 bg-slate-50">
                        &quot;Modular el dolor patelofemoral anterior a EVA ≤ 2/10 en reposo y carga en un plazo de 2 semanas.&quot;
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2 font-bold text-teal-900 bg-teal-50/40">
                        Fuerza Muscular
                      </td>
                      <td className="border border-slate-200 p-2">Incrementar / Desarrollar / Fortalecer</td>
                      <td className="border border-slate-200 p-2">la fuerza de cuádriceps y glúteo medio</td>
                      <td className="border border-slate-200 p-2">a grado M4+ en escala MRC</td>
                      <td className="border border-slate-200 p-2">al término de 4 semanas.</td>
                      <td className="border border-slate-200 p-2 italic text-slate-800 bg-slate-50">
                        &quot;Incrementar la fuerza de cuádriceps y glúteo medio a grado M4+ en escala MRC al término de 4 semanas.&quot;
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2 font-bold text-teal-900 bg-teal-50/40">
                        Movilidad / ROM
                      </td>
                      <td className="border border-slate-200 p-2">Ganar / Restablecer / Ampliar</td>
                      <td className="border border-slate-200 p-2">el rango activo de flexión de rodilla</td>
                      <td className="border border-slate-200 p-2">a +115° sin compensaciones</td>
                      <td className="border border-slate-200 p-2">en 3 semanas de intervención.</td>
                      <td className="border border-slate-200 p-2 italic text-slate-800 bg-slate-50">
                        &quot;Ganar el rango activo de flexión de rodilla a +115° sin compensaciones en 3 semanas de intervención.&quot;
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2 font-bold text-indigo-900 bg-indigo-50/40">
                        Marcha / Desplazamiento
                      </td>
                      <td className="border border-slate-200 p-2">Reeducar / Prolongar / Entrenar</td>
                      <td className="border border-slate-200 p-2">la tolerancia a la marcha continua</td>
                      <td className="border border-slate-200 p-2">durante 500 metros sin claudicación</td>
                      <td className="border border-slate-200 p-2">al cabo de 4 semanas.</td>
                      <td className="border border-slate-200 p-2 italic text-slate-800 bg-slate-50">
                        &quot;Prolongar la tolerancia a la marcha continua durante 500 metros sin claudicación al cabo de 4 semanas.&quot;
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2 font-bold text-indigo-900 bg-indigo-50/40">
                        Transferencias / Tareas
                      </td>
                      <td className="border border-slate-200 p-2">Entrenar / Independizar / Lograr</td>
                      <td className="border border-slate-200 p-2">la transición sedente a bípedo</td>
                      <td className="border border-slate-200 p-2">logrando 12 reps en Chair Stand Test</td>
                      <td className="border border-slate-200 p-2">en 3 semanas de programa.</td>
                      <td className="border border-slate-200 p-2 italic text-slate-800 bg-slate-50">
                        &quot;Entrenar la transición sedente a bípedo logrando 12 reps en Chair Stand Test en 3 semanas de programa.&quot;
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 p-2 font-bold text-purple-900 bg-purple-50/40">
                        Autonomía / Comunidad
                      </td>
                      <td className="border border-slate-200 p-2">Favorecer / Fomentar / Promover</td>
                      <td className="border border-slate-200 p-2">la autonomía en traslados comunitarios</td>
                      <td className="border border-slate-200 p-2">asistiendo de forma autónoma y segura</td>
                      <td className="border border-slate-200 p-2">2 veces por semana al término del ciclo.</td>
                      <td className="border border-slate-200 p-2 italic text-slate-800 bg-slate-50">
                        &quot;Favorecer la autonomía en traslados comunitarios asistiendo de forma autónoma y segura 2 veces por semana.&quot;
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ACORDEÓN 3: GUÍA DE PRIORIZACIÓN CLÍNICA */}
          <div className="border border-indigo-200 rounded-2xl overflow-hidden mb-5">
            <button
              type="button"
              onClick={() => setShowGuiaPriorizacion(!showGuiaPriorizacion)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition text-xs font-bold text-indigo-800"
            >
              <span>{showGuiaPriorizacion ? "Ocultar" : "Ver"} Guía: ¿Cómo definir el orden de prioridad de los Objetivos Específicos?</span>
              <span>{showGuiaPriorizacion ? "▲" : "▼"}</span>
            </button>

            {showGuiaPriorizacion && (
              <div className="p-4 bg-white text-xs text-slate-700 space-y-2 border-t border-indigo-200 leading-relaxed">
                <p className="font-bold text-indigo-900">
                  Criterio clínico para ordenar los objetivos específicos:
                </p>
                <div className="space-y-1.5 pt-1">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="font-bold text-slate-800">1. Prioridad #1 (Lo más limitante o urgente):</p>
                    <p className="text-slate-600">La deficiencia principal o síntoma agudo que bloquea el movimiento o genera mayor riesgo inmediato (ej. dolor agudo limitante, bloqueo articular, o riesgo crítico de caídas).</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="font-bold text-slate-800">2. Prioridad #2 (Capacidad neuromuscular o funcional base):</p>
                    <p className="text-slate-600">El factor biomecánico o fisiológico que habilita la función (ej. desarrollar fuerza muscular para tolerar la carga o ganar rango articular necesario).</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="font-bold text-slate-800">3. Prioridad #3 (Integración motriz y autonomía en la vida real):</p>
                    <p className="text-slate-600">El entrenamiento de la tarea motriz completa, patrón de marcha o autonomía en actividades comunitarias/laborales.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* PROBLEMA PRINCIPAL */}
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label required>Problema Kinesiológico Principal a Resolver</Label>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Impacto Biopsicosocial
                </span>
              </div>
              <p className="text-xs text-amber-950 leading-relaxed">
                Identifiquen el impacto funcional y en la vida de la persona (no es solo el dolor ni el nombre de la patología médica).
              </p>
              <FieldTA
                label=""
                required
                rows={2}
                value={caso.objetivos.problemaPrincipal}
                onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, problemaPrincipal: v } })}
                placeholder="Ej: Pérdida progresiva de la autonomía para trasladarse al paradero y realizar sus compras debido a fatiga muscular en miembros inferiores y temor a caídas..."
              />
            </div>

            {/* OBJETIVO GENERAL INTEGRADOR */}
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label required>Objetivo General de Intervención (Meta Integradora)</Label>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Propósito Macro
                </span>
              </div>
              <p className="text-xs text-emerald-950 leading-relaxed">
                Definan la gran meta de control motor o capacidad funcional contextualizada en la actividad o rol real de la persona (sin micro-mediciones analíticas).
              </p>
              <FieldTA
                label=""
                required
                rows={2}
                value={caso.objetivos.objetivoGeneral}
                onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, objetivoGeneral: v } })}
                placeholder="Ej: Optimizar el control unipodal dinámico de rodilla durante actividades de pivote para sus actividades deportivas..."
              />
            </div>

            {/* OBJETIVOS ESPECÍFICOS PRIORIZADOS (SIN SELECTOR DE DIMENSIÓN) */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Objetivos Específicos Priorizados</h4>
                  <p className="text-xs text-slate-500">Ordenados de mayor a menor urgencia e importancia clínica.</p>
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
                  <div key={obj.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="bg-teal-700 text-white text-xs font-black px-3 py-1 rounded-full">
                        Objetivo Específico #{idx + 1} {idx === 0 ? "· Prioridad Principal" : `· Prioridad ${idx + 1}`}
                      </span>

                      {caso.objetivos.especificos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeObjetivoEspecifico(obj.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    <FieldTA
                      label=""
                      required
                      rows={2}
                      value={obj.texto}
                      onChange={(v) => updateObjetivoEspecifico(obj.id, v)}
                      placeholder={`Redacten el objetivo específico de Prioridad #${idx + 1} siguiendo la estructura: [Verbo de acción] + [Parámetro a intervenir] + [Criterio de logro/Medición] + [Plazo temporal]...`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* 8. Plan de Intervención Dosificado FITT-VP */}
        <SectionCard title="8. Plan de intervención propuesto (Prescripción FITT-VP)">
          <GuideBox title="Prescripción y Dosificación FITT-VP">
            <p>
              Propongan las estrategias de intervención necesarias para dar cumplimiento a los objetivos que plantearon arriba.
            </p>
            <p className="mt-1">
              En cada estrategia, vinculen a qué <strong>Objetivo(s) Específico(s)</strong> tributa y completen los parámetros de dosificación:
            </p>
          </GuideBox>

          <div className="space-y-6">
            {caso.planIntervencion.estrategias.map((est, idx) => {
              const relList = est.objetivoRelacionado
                ? est.objetivoRelacionado.split(",").map((s) => s.trim()).filter(Boolean)
                : [];

              return (
                <div key={est.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-4 relative shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="bg-slate-900 text-white text-xs font-black px-3 py-1 rounded-full">
                      Estrategia de Intervención #{idx + 1}
                    </span>

                    {caso.planIntervencion.estrategias.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEstrategiaFitt(est.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Eliminar estrategia
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <FieldInput
                      label="Nombre de la Técnica / Modalidad terapéutica"
                      required
                      value={est.nombreEstrategia}
                      onChange={(v) => updateEstrategiaFitt(est.id, "nombreEstrategia", v)}
                      placeholder="Ej: Ejercicio de fuerza en cuádriceps, entrenamiento de transferencias, educación ergonómica..."
                    />

                    {/* SELECTOR DINÁMICO INTERACTIVO DE OBJETIVOS VINCULADOS */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                      <Label required>¿A qué Objetivo(s) tributa esta estrategia?</Label>
                      <p className="text-[11px] text-slate-500">
                        Hagan clic para vincular esta intervención a los objetivos que redactaron:
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {caso.objetivos.especificos.map((obj, i) => {
                          const tag = `Objetivo #${i + 1}`;
                          const isSelected = relList.includes(tag);
                          return (
                            <button
                              key={obj.id}
                              type="button"
                              onClick={() => toggleObjetivoRelacionado(est.id, tag)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 text-left ${
                                isSelected
                                  ? "bg-teal-600 border-teal-600 text-white shadow-sm"
                                  : "bg-slate-50 border-slate-300 text-slate-700 hover:border-teal-400"
                              }`}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-black border ${
                                  isSelected ? "bg-white text-teal-700 border-white" : "border-slate-400 bg-white"
                                }`}
                              >
                                {isSelected ? "✓" : ""}
                              </span>
                              <span>
                                Objetivo #{i + 1}:{" "}
                                <span className="font-normal opacity-90">
                                  {obj.texto ? (obj.texto.length > 30 ? `${obj.texto.slice(0, 30)}...` : obj.texto) : "Sin texto redactado"}
                                </span>
                              </span>
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => toggleObjetivoRelacionado(est.id, "Objetivo General")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                            relList.includes("Objetivo General")
                              ? "bg-emerald-700 border-emerald-700 text-white shadow-sm"
                              : "bg-slate-50 border-slate-300 text-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-black border ${
                              relList.includes("Objetivo General") ? "bg-white text-emerald-800 border-white" : "border-slate-400 bg-white"
                            }`}
                          >
                            {relList.includes("Objetivo General") ? "✓" : ""}
                          </span>
                          <span>Al Objetivo General</span>
                        </button>
                      </div>
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
              );
            })}

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
