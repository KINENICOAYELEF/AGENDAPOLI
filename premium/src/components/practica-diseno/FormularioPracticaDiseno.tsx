"use client";

import { useState, useEffect, useCallback } from "react";
import { enviarEntregaDiseno } from "@/services/practica-diseno";
import { casoDisenoVacio } from "@/types/practica-diseno";
import type { CasoDisenoIntervencion, DatosEstudianteDupla, EvaluacionDiseno, ObjetivoEspecificoItem } from "@/types/practica-diseno";

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
  rows = 5,
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
        className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-y placeholder:text-slate-400 min-h-[110px]"
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
  const STORAGE_KEY = "practica_diseno_borrador_v5";

  const [dupla, setDupla] = useState<DatosEstudianteDupla>({
    estudiante1: "",
    estudiante2: "",
    fechaJornada: new Date().toISOString().split("T")[0],
    centroAtencion: "",
  });

  const [caso, setCaso] = useState<CasoDisenoIntervencion>(casoDisenoVacio());

  // Estados de ejemplos desplegables
  const [showAnamnesisExample, setShowAnamnesisExample] = useState(false);
  const [showDiagExample, setShowDiagExample] = useState(false);

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
          // Asegurar compatibilidad de especificos
          const objParsed = parsed.caso.objetivos;
          if (objParsed && !Array.isArray(objParsed.especificos)) {
            objParsed.especificos = [
              { id: guid(), prioridad: 1, dimensionCIF: "Funciones y Estructuras", texto: objParsed.estructurasFunciones || "" },
              { id: guid(), prioridad: 2, dimensionCIF: "Actividades", texto: objParsed.actividades || "" },
              { id: guid(), prioridad: 3, dimensionCIF: "Participación", texto: objParsed.participacion || "" },
            ];
          }
          setCaso(parsed.caso);
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
    // Reordenar prioridades
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

    if (!caso.objetivos.objetivoGeneral.trim()) {
      setErrorMsg("Debe completar el Objetivo General de la intervención.");
      return;
    }

    const algunEspecificoVacio = caso.objetivos.especificos.some((obj) => !obj.texto.trim());
    if (caso.objetivos.especificos.length === 0 || algunEspecificoVacio) {
      setErrorMsg("Debe redactar el texto de todos los objetivos específicos priorizados.");
      return;
    }

    if (!caso.planIntervencion.estructurasFunciones.trim() || !caso.planIntervencion.actividades.trim() || !caso.planIntervencion.participacion.trim()) {
      setErrorMsg("Debe formular al menos una estrategia de intervención para cada dimensión CIF.");
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
          Formulario de entrega clínica enfocado en anamnesis, evaluaciones, matriz CIF, diagnóstico kinesiológico, objetivos priorizados, plan de intervención y pronóstico.
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
              placeholder="Ej: 42 años"
            />
            <FieldInput
              label="Ocupación o actividad principal"
              required
              value={caso.datosUsuaria.ocupacion}
              onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, ocupacion: v } })}
              placeholder="Ej: Auxiliar de aseo, estudiante, deportista recreativa, jubilado/a..."
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
            rows={4}
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
            <p className="mt-2 font-semibold">Escriban la información de forma ordenada, como un registro clínico profesional.</p>
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
                  <p><strong>Anamnesis próxima:</strong> Usuaria de 68 años, participa en talleres comunitarios, asiste a evaluación funcional para plan de envejecimiento activo y fortalecimiento. Refiere sensación de fatiga muscular en miembros inferiores al caminar más de 20 minutos y temor leve a caídas en terrenos irregulares. No relata caídas en los últimos 6 meses. Manifiesta alta motivación por mantener su autonomía y continuar asistiendo a sus actividades sociales de manera independiente.</p>
                  <p><strong>Anamnesis remota:</strong> Hipertensión arterial en tratamiento farmacológico con buen control. Sin antecedentes quirúrgicos recientes. Sedentaria en el hogar pero activa socialmente. Vive acompañada por su cónyuge en vivienda de un piso. Cuenta con buena red de apoyo familiar.</p>
                </div>
                <p className="text-indigo-600 italic">Noten el orden lógico: motivo/situación actual, nivel de funcionalidad, impacto en la vida diaria y antecedentes crónicos relevantes.</p>
              </div>
            )}
          </div>

          <FieldTA
            label="Anamnesis próxima y remota realizada"
            value={caso.anamnesis}
            onChange={(v) => setCaso({ ...caso, anamnesis: v })}
            required
            rows={14}
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
                rows={8}
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
                    rows={3}
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
                    rows={3}
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
            rows={3}
            placeholder="El hallazgo funcional o clínico prioritario..."
          />
          <FieldTA
            label="Hallazgo 2"
            value={caso.hallazgo2}
            onChange={(v) => setCaso({ ...caso, hallazgo2: v })}
            required
            rows={3}
            placeholder="Segundo hallazgo relevante..."
          />
          <FieldTA
            label="Hallazgo 3"
            value={caso.hallazgo3}
            onChange={(v) => setCaso({ ...caso, hallazgo3: v })}
            required
            rows={3}
            placeholder="Tercer hallazgo relevante..."
          />
        </SectionCard>

        {/* 5. Tabla CIF */}
        <SectionCard title="5. Tabla CIF – Clasificación del caso">
          <GuideBox title="Guía para completar la CIF">
            <p>La CIF (Clasificación Internacional del Funcionamiento) sirve para <strong>ordenar y clasificar profesionalmente el caso</strong>. Cada componente responde a una pregunta diferente:</p>
            <div className="mt-2 bg-white border border-blue-200 rounded-lg p-3 space-y-1">
              <p><strong>Estructuras</strong> = ¿Qué parte del cuerpo está comprometida o evaluada? (tejidos físicos, articulaciones, masa muscular)</p>
              <p><strong>Funciones</strong> = ¿Qué capacidad fisiológica está alterada o disminuida? (fuerza, equilibrio, movilidad, dolor, resistencia)</p>
              <p><strong>Actividades</strong> = ¿Qué tareas o acciones concretas están limitadas o requieren entrenamiento? (marcha, escaleras, transferencias, alcanzar objetos)</p>
              <p><strong>Participación</strong> = ¿Cómo afecta o facilita sus roles vitales? (vida comunitaria, talleres, trabajo, recreación, hogar)</p>
              <p><strong>F. Personales</strong> = ¿Qué factores propios de la persona facilitan (+) o dificultan (-)? (edad, motivación, autoeficacia, hábitos)</p>
              <p><strong>F. Ambientales</strong> = ¿Qué del entorno físico y social ayuda (+) o dificulta (-)? (red de apoyo, barreras arquitectónicas, acceso)</p>
            </div>
          </GuideBox>

          {/* Guía de severidad */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-xs text-purple-900 space-y-2 mb-4">
            <p className="font-bold text-sm text-purple-800">¿Cómo clasificar la severidad?</p>
            <p>Cuando agreguen funciones alteradas, actividades limitadas o restricciones de participación, indiquen <strong>qué tan afectado</strong> está cada ítem:</p>
            <div className="mt-2 space-y-2">
              <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold shrink-0 mt-0.5">Leve</span>
                <div>
                  <p className="font-semibold text-purple-800">Alteración funcional pequeña. La persona realiza la tarea con ligera dificultad o molestia mínima.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold shrink-0 mt-0.5">Moderado</span>
                <div>
                  <p className="font-semibold text-purple-800">Alteración funcional evidente. La persona realiza la actividad con dificultad importante o requiere adaptaciones/pausas.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-bold shrink-0 mt-0.5">Severo</span>
                <div>
                  <p className="font-semibold text-purple-800">Gran alteración funcional. La persona tiene mucha dificultad, casi no puede realizar la tarea o depende de asistencia.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold shrink-0 mt-0.5">Completo</span>
                <div>
                  <p className="font-semibold text-purple-800">Alteración funcional total o incapacidad absoluta para ejecutar la acción.</p>
                </div>
              </div>
            </div>
          </div>

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
            rows={14}
            placeholder="Redacten su diagnóstico kinesiológico integrando: (1) Identificación y contexto, (2) Problemas o metas desde la persona, (3) Déficits estructurales/funcionales desde el tratante, y (4) Factores personales y ambientales..."
          />
        </SectionCard>

        {/* 7. Objetivos de Intervención Priorizados */}
        <SectionCard title="7. Objetivos de intervención (Priorizados por relevancia clínica)">
          <GuideBox title="¿Cómo formular y priorizar objetivos kinesiológicos?">
            <p><strong>Criterio 4 de Rúbrica:</strong> Los objetivos deben guardar coherencia directa con el diagnóstico y ser alcanzables.</p>
            <p className="mt-1">
              • <strong>Objetivo General:</strong> Define la meta funcional global más importante que se espera alcanzar con el plan de intervención.
            </p>
            <p className="mt-1">
              • <strong>Objetivos Específicos:</strong> Deben estar <strong>estrictamente ordenados por prioridad clínica</strong> (1º Prioridad: lo más urgente o esencial para la persona; 2º Prioridad; 3º Prioridad...). En cada uno indiquen a qué dimensión CIF apunta (Funciones/Estructuras, Actividades o Participación).
            </p>
            <div className="mt-2 bg-white border border-blue-200 rounded-lg p-2.5 font-mono text-[11px] text-slate-800">
              <strong>Fórmula de redacción:</strong> [Verbo en infinitivo] + [Variable / Parámetro funcional] + [Criterio de logro / Magnitud] + [Plazo o condición]
            </div>
          </GuideBox>

          <FieldTA
            label="Objetivo General de intervención"
            required
            rows={3}
            value={caso.objetivos.objetivoGeneral}
            onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, objetivoGeneral: v } })}
            placeholder="Meta global funcional de la intervención. Fórmula: [Verbo] + [Variable funcional principal] + [Criterio de éxito] + [Plazo temporal]..."
          />

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
                    rows={3}
                    value={obj.texto}
                    onChange={(v) => updateObjetivoEspecifico(obj.id, "texto", v)}
                    placeholder="Redacten el objetivo específico siguiendo la fórmula: [Verbo en infinitivo] + [Parámetro a intervenir] + [Criterio de logro/Medición] + [Plazo temporal]..."
                  />
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* 8. Plan de Intervención */}
        <SectionCard title="8. Plan de intervención propuesto (Estrategias CIF)">
          <GuideBox title="Metodología de prescripción kinésica por dimensión CIF (Criterio 5)">
            <p>El plan debe ser <strong>coherente con los objetivos priorizados</strong> e incluir al menos <strong>una estrategia de intervención para cada dimensión CIF</strong>.</p>
            <p className="mt-1 font-semibold">Toda estrategia terapéutica debe detallar:</p>
            <div className="mt-2 ml-2 space-y-1 text-slate-700">
              <p>1. <strong>Técnica / Modalidad:</strong> Ejercicio terapéutico (fuerza, equilibrio, resistencia), terapia manual, reeducación de patrones de movimiento, entrenamiento en tareas funcionales, educación ergonómica o para el envejecimiento activo.</p>
              <p>2. <strong>Dosificación (FITT):</strong> Frecuencia (veces por semana), Intensidad (esfuerzo RPE, carga, dificultad), Volumen/Tiempo (series, repeticiones, duración, descansos) y Tipo de contracción/estímulo.</p>
              <p>3. <strong>Criterio de Progresión:</strong> Parámetro objetivo para aumentar la complejidad o dosificación.</p>
            </div>
          </GuideBox>

          <div className="space-y-4">
            <FieldTA
              label="Estrategia(s) para Estructuras y Funciones Corporales"
              required
              rows={4}
              value={caso.planIntervencion.estructurasFunciones}
              onChange={(v) =>
                setCaso({ ...caso, planIntervencion: { ...caso.planIntervencion, estructurasFunciones: v } })
              }
              placeholder="Detallen la modalidad terapéutica y su dosificación exacta (series, repeticiones, frecuencia, intensidad) para modular dolor, optimizar fuerza muscular, rango articular o capacidad cardiorrespiratoria..."
            />

            <FieldTA
              label="Estrategia(s) para Actividades"
              required
              rows={4}
              value={caso.planIntervencion.actividades}
              onChange={(v) =>
                setCaso({ ...caso, planIntervencion: { ...caso.planIntervencion, actividades: v } })
              }
              placeholder="Detallen cómo entrenarán las tareas motrices específicas (marcha, equilibrio dinámico, prevención de caídas, escaleras, transferencias), indicando variaciones de superficie, velocidad y progresión funcional..."
            />

            <FieldTA
              label="Estrategia(s) para Participación"
              required
              rows={4}
              value={caso.planIntervencion.participacion}
              onChange={(v) =>
                setCaso({ ...caso, planIntervencion: { ...caso.planIntervencion, participacion: v } })
              }
              placeholder="Detallen estrategias para favorecer la autonomía en roles sociales, comunitarios o laborales: educación en hábitos y envejecimiento activo, pauta de ejercicios domiciliarios, adaptación ambiental o guía a cuidadores..."
            />
          </div>
        </SectionCard>

        {/* 9. Pronóstico Incipiente */}
        <SectionCard title="9. Pronóstico (incipiente) final y factores pronósticos">
          <GuideBox title="¿Cómo razonar y fundamentar el pronóstico kinesiológico? (Criterio 6)">
            <p>El pronóstico es la <strong>estimación razonada del potencial y tiempo de recuperación o mantenimiento funcional</strong> de la persona (tanto en rehabilitación de lesiones como en programas de envejecimiento activo o manejo crónico). Debe integrar:</p>
            <div className="mt-2 ml-2 space-y-1 text-slate-700">
              <p>1. <strong>Fisiología y adaptabilidad:</strong> Capacidad intrínseca, reserva funcional o tiempos biológicos de cicatrización/adaptación esperados.</p>
              <p>2. <strong>Respaldo del plan de intervención:</strong> Explicar por qué las estrategias seleccionadas resolverán o mitigarán los déficits diagnosticados.</p>
              <p>3. <strong>Factores Pronósticos Biopsicosociales:</strong> Declarar obligatoriamente <strong>al menos 3 factores</strong> que facilitan (+) o dificultan (-) la evolución (edad, comorbilidades, adherencia, exigencia laboral/física, motivación, red de apoyo, entorno).</p>
            </div>
          </GuideBox>

          <FieldTA
            label="Fundamentación del pronóstico incipiente"
            required
            rows={4}
            value={caso.pronostico.fundamentacion}
            onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, fundamentacion: v } })}
            placeholder="Fundamenten la expectativa de evolución funcional (nivel de autonomía alcanzable o tiempo estimado de mejora/mantenimiento) basándose en la condición clínica, respuesta al ejercicio y adaptabilidad funcional..."
          />

          <FieldTA
            label="Relación con el diagnóstico e intervención propuesta"
            required
            rows={3}
            value={caso.pronostico.relacionDiagnosticoEIntervencion}
            onChange={(v) =>
              setCaso({ ...caso, pronostico: { ...caso.pronostico, relacionDiagnosticoEIntervencion: v } })
            }
            placeholder="Expliquen de qué manera el plan de intervención planteado respalda y hace viable el logro de este pronóstico a partir del diagnóstico inicial..."
          />

          <div className="pt-2">
            <Label required>Declaración de Factores Pronósticos (Obligatorio declarar 3):</Label>
            <p className="text-xs text-slate-500 mb-3">Identifiquen al menos 3 factores biopsicosociales concretos presentes en la persona o su entorno.</p>
            <div className="space-y-3">
              <FieldInput
                label="Factor Pronóstico 1"
                required
                value={caso.pronostico.factorPronostico1}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico1: v } })}
                placeholder="Ej: Factor personal / conductual (+): Alta adherencia a las sesiones y comprensión del ejercicio..."
              />
              <FieldInput
                label="Factor Pronóstico 2"
                required
                value={caso.pronostico.factorPronostico2}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico2: v } })}
                placeholder="Ej: Factor ambiental / físico (-): Presencia de barreras arquitectónicas en el entorno inmediato..."
              />
              <FieldInput
                label="Factor Pronóstico 3"
                required
                value={caso.pronostico.factorPronostico3}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico3: v } })}
                placeholder="Ej: Factor biológico / clínico (+): Buena capacidad intrínseca y ausencia de descompensación crónica..."
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
