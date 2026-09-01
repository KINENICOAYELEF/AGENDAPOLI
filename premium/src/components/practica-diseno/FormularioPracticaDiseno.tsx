"use client";

import { useState, useEffect, useCallback } from "react";
import { enviarEntregaDiseno } from "@/services/practica-diseno";
import { casoDisenoVacio } from "@/types/practica-diseno";
import type { CasoDisenoIntervencion, DatosEstudianteDupla, EvaluacionDiseno } from "@/types/practica-diseno";

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
  rows = 6,
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
        className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-y placeholder:text-slate-400 min-h-[120px]"
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
  const STORAGE_KEY = "practica_diseno_borrador_v3";

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
  const [showObjExample, setShowObjExample] = useState(false);
  const [showPlanExample, setShowPlanExample] = useState(false);
  const [showPronosticoExample, setShowPronosticoExample] = useState(false);

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
        if (parsed.caso) setCaso(parsed.caso);
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
          Formulario de entrega clínica enfocado en anamnesis, evaluaciones, matriz CIF, diagnóstico kinesiológico, objetivos, plan de intervención y pronóstico.
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
              placeholder="Ej: Auxiliar de aseo, estudiante, deportista recreativa..."
            />
            <FieldInput
              label="Contexto de atención"
              required
              value={caso.datosUsuaria.contextoAtencion}
              onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, contextoAtencion: v } })}
              placeholder="Ej: CESFAM, centro comunitario, hospital..."
            />
          </div>

          <FieldTA
            label="Motivo principal de consulta o atención"
            required
            rows={4}
            value={caso.datosUsuaria.motivoConsulta}
            onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, motivoConsulta: v } })}
            placeholder="Describe el motivo según lo que la persona refiere. Ej: Consulta por dolor en rodilla derecha que le dificulta caminar y subir escaleras desde hace 3 semanas..."
          />
        </SectionCard>

        {/* 2. Anamnesis / Entrevista clínica */}
        <SectionCard title="2. Anamnesis / Entrevista clínica">
          <GuideBox title="¿Qué se espera en esta sección?">
            <p>Escriban la <strong>entrevista clínica completa</strong> que realizaron como tratantes. Incluyan anamnesis próxima (problema actual) y remota (antecedentes). La anamnesis debe intentar responder:</p>
            <div className="mt-2 ml-2 space-y-0.5">
              {[
                "¿Cuál es el problema principal que refiere la persona?",
                "¿Desde cuándo ocurre? ¿Cómo comenzó?",
                "¿Cómo ha evolucionado? ¿Ha cambiado en intensidad o frecuencia?",
                "¿Qué actividades le molestan, le cuestan o ya no puede hacer?",
                "¿Qué cosas alivian o aumentan el problema?",
                "¿Ha tenido tratamientos previos? ¿Cuáles? ¿Funcionaron?",
                "¿Qué antecedentes remotos relevantes tiene (enfermedades, cirugías, otros problemas)?",
                "¿Qué espera lograr con esta atención?",
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
              <span>{showAnamnesisExample ? "Ocultar" : "Ver"} ejemplo de anamnesis bien registrada</span>
              <span>{showAnamnesisExample ? "▲" : "▼"}</span>
            </button>
            {showAnamnesisExample && (
              <div className="px-4 py-4 bg-white text-xs text-slate-700 space-y-3 leading-relaxed border-t border-indigo-200">
                <p className="font-bold text-indigo-700">Ejemplo de anamnesis profesional:</p>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2.5 border border-slate-200">
                  <p><strong>Anamnesis próxima:</strong></p>
                  <p>Usuaria de 52 años, trabajadora de aseo en establecimiento educacional, consulta por dolor en región anterior de rodilla derecha de 4 semanas de evolución. Refiere inicio insidioso, sin mecanismo traumático claro, que asocia al aumento de carga laboral durante periodo de limpieza profunda. El dolor se localiza principalmente en la cara anterior de la rodilla, sin irradiación, y lo describe como &quot;presión&quot; que aumenta al subir y bajar escaleras, al ponerse de pie desde posición sentada baja y al caminar distancias superiores a 500 metros. Califica el dolor como 6/10 en escala numérica durante actividades provocadoras, descendiendo a 2/10 en reposo. Refiere que el dolor mejora parcialmente con reposo y empeora al final de la jornada laboral. No presenta síntomas neurológicos, ni bloqueos articulares, ni episodios de inestabilidad.</p>
                  <p><strong>Anamnesis remota:</strong></p>
                  <p>Sin antecedentes quirúrgicos. Hipertensión arterial controlada con medicación (losartán). Sin antecedentes de lesiones previas en rodilla. Refiere episodio de dolor lumbar hace 2 años, tratado con kinesiología durante 8 sesiones con buena evolución. Sedentaria, sin actividad física regular fuera de su trabajo. IMC estimado en rango de sobrepeso. No fuma. Vive en primer piso, pero su trabajo requiere subir y bajar escaleras frecuentemente. Motivada a mejorar porque el dolor le está dificultando cumplir con su trabajo y tiene temor de solicitar licencia.</p>
                </div>
                <p className="text-indigo-600 italic">Noten cómo la anamnesis está ordenada (próxima → remota), usa lenguaje profesional, incluye temporalidad, mecanismo, localización, factores agravantes/aliviantes, severidad y antecedentes relevantes.</p>
              </div>
            )}
          </div>

          <FieldTA
            label="Anamnesis próxima y remota realizada"
            value={caso.anamnesis}
            onChange={(v) => setCaso({ ...caso, anamnesis: v })}
            required
            rows={14}
            placeholder="Registren aquí la entrevista clínica completa, ordenada profesionalmente. Primero la anamnesis próxima (problema actual: inicio, evolución, localización, factores agravantes/aliviantes, severidad, impacto funcional). Luego la anamnesis remota (antecedentes relevantes: cirugías, enfermedades, tratamientos previos, hábitos, factores de riesgo)..."
          />

          <div className="border-t border-slate-200 pt-5">
            <GuideBox title="Interpretación de la anamnesis (análisis del tratante)">
              <p><strong>No repitan la anamnesis.</strong> Aquí deben analizar como tratantes: ¿qué datos les parecen más relevantes clínicamente y por qué?</p>
              <p className="mt-1.5">Piensen: si tuvieran que explicarle a otro kinesiólogo lo más importante de este caso en 30 segundos, ¿qué le dirían?</p>
              <p className="mt-2 italic text-blue-700">
                Ejemplo: &quot;Lo más relevante clínicamente es el dolor anterior de rodilla de inicio insidioso asociado a sobrecarga laboral, con un patrón mecánico claro que apunta a compromiso del complejo patelofemoral. La ausencia de mecanismo traumático y la evolución progresiva sugieren una causa por sobreuso más que estructural aguda. Los factores clave son: el sedentarismo previo combinado con alta demanda laboral (subir/bajar escaleras repetidamente), el sobrepeso como factor de carga articular adicional, y la alta motivación de la persona por mejorar. La prioridad clínica será confirmar la hipótesis patelofemoral en la evaluación y determinar la tolerancia a carga actual del miembro inferior.&quot;
              </p>
            </GuideBox>

            <div className="mt-4">
              <FieldTA
                label="Interpretación de la anamnesis"
                value={caso.interpretacionAnamnesis}
                onChange={(v) => setCaso({ ...caso, interpretacionAnamnesis: v })}
                required
                rows={10}
                placeholder="Expliquen como tratantes: ¿Qué datos de la entrevista son los más relevantes clínicamente? ¿Por qué? ¿Qué hipótesis empiezan a formarse sobre el problema? ¿Qué prioridades clínicas identifican?..."
              />
            </div>
          </div>
        </SectionCard>

        {/* 3. Evaluaciones */}
        <SectionCard title="3. Evaluaciones realizadas por el tratante">
          <GuideBox title="¿Qué tipo de evaluaciones se esperan?">
            <p>Registren las evaluaciones pertinentes que realizaron como tratantes. Cada una debe tener: nombre, razón clínica de elección, resultado obtenido e interpretación inmediata.</p>
            <p className="mt-1.5">Pueden ser: observación del movimiento o postura · ROM activo · evaluación del dolor (EVA) · fuerza manual básica · equilibrio (Romberg, apoyo unipodal) · evaluación de marcha · transferencias · tarea funcional relevante · otra pertinente al caso.</p>
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
                    label="Nombre de la evaluación"
                    value={ev.nombre}
                    onChange={(v) => updateEvaluacion(ev.id, "nombre", v)}
                    required
                    placeholder="Ej: Rango de movimiento activo de flexión de rodilla derecha"
                  />
                  <FieldTA
                    label="¿Por qué eligieron esta evaluación?"
                    value={ev.razon}
                    onChange={(v) => updateEvaluacion(ev.id, "razon", v)}
                    required
                    rows={3}
                    placeholder="Ej: Porque la persona refiere dolor al flectar la rodilla y necesitamos cuantificar la limitación antes de intervenir..."
                  />
                  <FieldInput
                    label="Resultado obtenido"
                    value={ev.resultado}
                    onChange={(v) => updateEvaluacion(ev.id, "resultado", v)}
                    required
                    placeholder="Ej: 90° de flexión activa (contralateral 135°), dolor 6/10 al final del rango"
                  />
                  <FieldTA
                    label="Interpretación inmediata del resultado"
                    value={ev.interpretacion}
                    onChange={(v) => updateEvaluacion(ev.id, "interpretacion", v)}
                    required
                    rows={4}
                    placeholder="¿Qué significa este resultado para el caso? Ej: La limitación de 90° con dolor al final del rango indica restricción significativa. Se requieren al menos 110° para subir escaleras normalmente, que es su actividad más limitada..."
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
            <p>Seleccionen <strong>solo los 3 datos más importantes</strong> que obtuvieron de la entrevista y la evaluación. No escriban todo. Elijan lo que realmente ayuda a entender el caso.</p>
            <p className="mt-1 italic text-blue-700">Ejemplo: &quot;Limitación significativa de flexión activa de rodilla (90° vs 135° contralateral) con dolor 6/10 al final del rango, compatible con compromiso del complejo patelofemoral por sobreuso.&quot;</p>
          </GuideBox>
          <FieldTA
            label="Hallazgo 1 (el más relevante)"
            value={caso.hallazgo1}
            onChange={(v) => setCaso({ ...caso, hallazgo1: v })}
            required
            rows={3}
            placeholder="El hallazgo más importante..."
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
            <p>La CIF (Clasificación Internacional del Funcionamiento) sirve para <strong>ordenar y clasificar profesionalmente el caso</strong>. Cada componente responde a una pregunta diferente.</p>
            <div className="mt-2 bg-white border border-blue-200 rounded-lg p-3 space-y-1">
              <p><strong>Estructuras</strong> = ¿Qué parte del cuerpo está comprometida? (tejidos físicos)</p>
              <p><strong>Funciones</strong> = ¿Qué capacidad está alterada? (dolor, fuerza, movilidad...)</p>
              <p><strong>Actividades</strong> = ¿Qué tareas concretas no puede hacer bien?</p>
              <p><strong>Participación</strong> = ¿Cómo afecta su vida real, roles, rutina?</p>
              <p><strong>F. Personales</strong> = ¿Qué de la persona facilita o dificulta?</p>
              <p><strong>F. Ambientales</strong> = ¿Qué del entorno ayuda o dificulta?</p>
            </div>
          </GuideBox>

          {/* Guía de severidad */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-xs text-purple-900 space-y-2 mb-4">
            <p className="font-bold text-sm text-purple-800">¿Cómo clasificar la severidad?</p>
            <p>Cuando agreguen funciones alteradas, actividades limitadas o restricciones de participación, deben indicar <strong>qué tan afectado</strong> está cada ítem. Usen esta escala:</p>
            <div className="mt-2 space-y-2">
              <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold shrink-0 mt-0.5">Leve</span>
                <div>
                  <p className="font-semibold text-purple-800">Hay una alteración funcional pequeña, o la persona puede hacer la actividad pero con molestia menor.</p>
                  <div className="text-purple-600 italic mt-0.5 text-[11px] space-y-0.5">
                    <p><strong>Función:</strong> Dolor leve (1 a 3/10) · Disminución mínima de rango de movimiento.</p>
                    <p><strong>Actividad:</strong> Puede caminar normalmente pero siente molestia leve después de 1 km.</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold shrink-0 mt-0.5">Moderado</span>
                <div>
                  <p className="font-semibold text-purple-800">Alteración funcional evidente. La persona puede hacer la actividad, pero con dificultad importante y debe adaptarse.</p>
                  <div className="text-purple-600 italic mt-0.5 text-[11px] space-y-0.5">
                    <p><strong>Función:</strong> Dolor moderado (4 a 6/10) · Limitación evidente de movilidad (ej. flexión hasta 90°).</p>
                    <p><strong>Actividad:</strong> Puede subir escaleras, pero debe ir lento y agarrarse del pasamanos.</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-bold shrink-0 mt-0.5">Severo</span>
                <div>
                  <p className="font-semibold text-purple-800">Gran alteración funcional. La persona tiene mucha dificultad, casi no puede hacer la actividad o necesita ayuda.</p>
                  <div className="text-purple-600 italic mt-0.5 text-[11px] space-y-0.5">
                    <p><strong>Función:</strong> Dolor intenso (7 a 9/10) · Articulación casi rígida · Debilidad extrema.</p>
                    <p><strong>Actividad:</strong> Prácticamente no puede agacharse, necesita que otra persona le recoja objetos.</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold shrink-0 mt-0.5">Completo</span>
                <div>
                  <p className="font-semibold text-purple-800">Alteración funcional total. La limitación para la actividad es absoluta.</p>
                  <div className="text-purple-600 italic mt-0.5 text-[11px] space-y-0.5">
                    <p><strong>Función:</strong> Dolor insoportable (10/10) · Parálisis completa · Bloqueo articular total.</p>
                    <p><strong>Actividad:</strong> No puede correr ni trotar bajo ninguna circunstancia por dolor limitante.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-900 mb-4">
            <p className="font-bold">Importante:</p>
            <p className="mt-1">Cada ítem que agreguen <strong>debe haber sido encontrado en la entrevista o la evaluación</strong>. No inventen ni supongan cosas que no observaron. Los ejemplos son solo orientativos — los ítems reales dependen de cada caso.</p>
          </div>

          <div className="space-y-4">
            <CifSection
              title="A. Estructuras corporales"
              subtitle="¿Qué estructuras del cuerpo podrían estar relacionadas con el problema?"
              helpContent={
                <HelpText>
                  Registren los <strong>tejidos, articulaciones, músculos, tendones, ligamentos, nervios o huesos</strong> que podrían estar involucrados según lo que encontraron en la entrevista y evaluación. No necesitan estar 100% seguros — pueden indicar estructuras &quot;sospechadas&quot;. No se usa severidad aquí.
                  <br/><br/>
                  <strong>Algunos ejemplos (dependen del caso):</strong> Complejo patelofemoral derecho · Tendón rotuliano · Musculatura cuadricipital · Columna lumbar (segmentos L4-L5) · Manguito rotador · Nervio mediano · Fascia plantar · Ligamento colateral medial · Cápsula glenohumeral.
                </HelpText>
              }
              items={getCifItems("estructurasCorporales")}
              onChange={(items) => setCifItems("estructurasCorporales", items)}
              placeholder="Ej: Complejo patelofemoral derecho"
              showSeveridad={false}
            />

            <CifSection
              title="B. Funciones corporales alteradas"
              subtitle="¿Qué funciones corporales encontraron alteradas en la evaluación?"
              helpContent={
                <HelpText>
                  Las funciones son <strong>capacidades del cuerpo</strong> que están disminuidas o alteradas. No son las estructuras (esas van arriba) ni las actividades (esas van abajo). <strong>Seleccionen la severidad</strong> según la guía de arriba.
                  <br/><br/>
                  <strong>Algunos ejemplos (incluyan solo las que encontraron alteradas):</strong> Dolor en región anterior de rodilla · Movilidad articular de flexión de rodilla · Fuerza muscular de cuádriceps · Control motor dinámico de rodilla · Equilibrio en apoyo unipodal · Tolerancia a carga en miembro inferior · Propiocepción · Edema periarticular.
                </HelpText>
              }
              items={getCifItems("funcionesCorporales")}
              onChange={(items) => setCifItems("funcionesCorporales", items)}
              placeholder="Ej: Dolor en región anterior de rodilla"
              showSeveridad={true}
            />

            <CifSection
              title="C. Actividades limitadas"
              subtitle="¿Qué actividades concretas están limitadas?"
              helpContent={
                <HelpText>
                  Las actividades son <strong>tareas y acciones concretas</strong> que la persona tiene dificultad o no puede hacer. Son verbos o acciones, no diagnósticos ni funciones. <strong>Seleccionen la severidad</strong> según la guía.
                  <br/><br/>
                  <strong>Algunos ejemplos (incluyan las que la persona reportó o que ustedes observaron):</strong> Subir escaleras · Caminar distancias largas (&gt;500m) · Agacharse a recoger objetos · Sentarse y levantarse de silla baja · Correr · Levantar objetos del suelo · Vestirse la parte inferior · Permanecer de pie más de 30 minutos.
                </HelpText>
              }
              items={getCifItems("actividades")}
              onChange={(items) => setCifItems("actividades", items)}
              placeholder="Ej: Subir escaleras"
              showSeveridad={true}
            />

            <CifSection
              title="D. Restricción de participación"
              subtitle="¿En qué roles o situaciones de la vida real participa menos o con dificultad?"
              helpContent={
                <HelpText>
                  La participación es el <strong>impacto en la vida real</strong>: sus roles, rutina y cosas que le importan. No es lo mismo que actividades: subir escaleras es actividad; no poder ir al trabajo porque hay escaleras es <strong>participación</strong>. <strong>Seleccionen la severidad</strong>.
                  <br/><br/>
                  <strong>Algunos ejemplos (según lo que la persona contó):</strong> Cumplir jornada laboral completa · Participar en actividades deportivas recreativas · Cumplir rol de cuidador/a de hijos · Actividades sociales con amigos · Independencia en tareas del hogar · Actividades de ocio · Vida académica o de estudios.
                </HelpText>
              }
              items={getCifItems("participacion")}
              onChange={(items) => setCifItems("participacion", items)}
              placeholder="Ej: Cumplir jornada laboral completa"
              showSeveridad={true}
            />

            <CifSection
              title="E. Factores personales"
              subtitle="¿Qué factores propios de la persona facilitan o dificultan su recuperación?"
              helpContent={
                <HelpText>
                  Características internas de la persona. Indiquen si cada factor es un <strong>facilitador (+)</strong> o una <strong>barrera (-)</strong> escribiéndolo al inicio. No se usa severidad aquí.
                  <br/><br/>
                  <strong>Facilitadores (+):</strong> Alta motivación · Buena comprensión del problema · Adherente a indicaciones · Expectativas realistas · Experiencia deportiva previa · Joven y activa.
                  <br/>
                  <strong>Barreras (-):</strong> Miedo al movimiento · Baja autoeficacia · Sedentarismo · Expectativas irreales · Creencias limitantes sobre el dolor · Experiencias negativas con kinesiólogos — <em>según lo que obtuvieron del caso real</em>.
                </HelpText>
              }
              items={getCifItems("factoresPersonales")}
              onChange={(items) => setCifItems("factoresPersonales", items)}
              placeholder="Ej: (+) Alta motivación por mejorar"
              showSeveridad={false}
            />

            <CifSection
              title="F. Factores ambientales"
              subtitle="¿Qué del entorno ayuda o dificulta la situación?"
              helpContent={
                <HelpText>
                  Elementos del <strong>entorno externo</strong>. Indiquen si cada factor es un <strong>facilitador (+)</strong> o una <strong>barrera (-)</strong>. No se usa severidad aquí.
                  <br/><br/>
                  <strong>Facilitadores (+):</strong> Apoyo familiar presente · Acceso a gimnasio o espacio para ejercicio · Horario flexible · Buena red de apoyo · Entrenador colaborador.
                  <br/>
                  <strong>Barreras (-):</strong> Trabajo físico pesado que no puede modificar · Vive en piso alto sin ascensor · Largos traslados diarios · Poco tiempo disponible · Presión laboral por reintegrarse rápido — <em>según la información real del caso</em>.
                </HelpText>
              }
              items={getCifItems("factoresAmbientales")}
              onChange={(items) => setCifItems("factoresAmbientales", items)}
              placeholder="Ej: (-) Vive en tercer piso sin ascensor"
              showSeveridad={false}
            />
          </div>
        </SectionCard>

        {/* 6. Diagnóstico Kinesiológico */}
        <SectionCard title="6. Diagnóstico kinesiológico incipiente">
          <GuideBox title="¿Qué es un diagnóstico kinesiológico?">
            <p>Un diagnóstico kinesiológico <strong>NO es decir &quot;tiene tendinitis&quot; o &quot;tiene dolor lumbar&quot;</strong>. Eso es un diagnóstico médico.</p>
            <p className="mt-1.5">Un diagnóstico kinesiológico es un <strong>texto integrador</strong> donde ustedes como tratantes resumen y conectan toda la información que obtuvieron: quién es la persona, qué problema tiene, qué encontraron en la evaluación, y qué factores influyen.</p>
            <p className="mt-1.5">A continuación tienen una <strong>plantilla que deben seguir</strong>. Reemplacen los textos en [corchetes] con la información real de su caso. No copien los corchetes — escriban directamente lo que corresponda.</p>
          </GuideBox>

          {/* Plantilla a 4 puntos */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-xs text-indigo-900 space-y-4 mb-4">
            <p className="font-bold text-sm text-indigo-800">Plantilla a seguir — reemplacen los [corchetes] con su información</p>

            <div className="space-y-5 bg-white border border-indigo-200 rounded-lg p-5">
              <div>
                <p className="font-bold text-indigo-700 text-sm">1. Identificación y contexto relevante</p>
                <p className="text-slate-600 italic mt-2 leading-relaxed">[Iniciales], [edad], [sexo], [ocupación], consulta por [motivo principal] de [tiempo de evolución]. El cuadro se asocia a [mecanismo, sobrecarga o antecedente relevante].</p>
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <p className="text-green-800 text-[11px]"><strong>Ejemplo:</strong> M.G., 52 años, sexo femenino, auxiliar de aseo, consulta por dolor en región anterior de rodilla derecha de 4 semanas de evolución. El cuadro se asocia a sobrecarga laboral durante periodo de limpieza profunda, sin mecanismo traumático.</p>
                </div>
              </div>

              <div className="border-t border-indigo-100 pt-4">
                <p className="font-bold text-indigo-700 text-sm">2. Problemas identificados por la persona</p>
                <p className="text-slate-600 italic mt-2 leading-relaxed">Desde la perspectiva de la persona, el problema se expresa como dificultad para [actividad 1], [actividad 2] y [actividad 3], con severidad [leve/moderada/severa]. Esto restringe su participación en [trabajo/deporte/hogar/otro].</p>
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <p className="text-green-800 text-[11px]"><strong>Ejemplo:</strong> Desde la perspectiva de la persona, el problema se expresa como dificultad para subir y bajar escaleras, ponerse de pie desde silla baja y caminar más de 500 metros, con severidad moderada. Esto restringe su participación laboral, ya que tiene dificultad para completar la jornada de trabajo.</p>
                </div>
              </div>

              <div className="border-t border-indigo-100 pt-4">
                <p className="font-bold text-indigo-700 text-sm">3. Problemas identificados por el tratante</p>
                <p className="text-slate-600 italic mt-2 leading-relaxed">Desde nuestra evaluación, el cuadro compromete predominantemente el sistema [musculoesquelético/neuromuscular/otro].</p>
                <p className="text-slate-600 italic mt-1.5 leading-relaxed">A nivel de <strong>estructuras</strong>: compromiso [confirmado/probable/sospechado] de [estructura], sustentado por [evidencia].</p>
                <p className="text-slate-600 italic mt-1.5 leading-relaxed">A nivel de <strong>funciones</strong>: [dolor: severidad], [movilidad: severidad], [fuerza: severidad], [control motor: severidad], [otros hallazgos relevantes].</p>
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <p className="text-green-800 text-[11px]"><strong>Ejemplo:</strong> Desde nuestra evaluación, el cuadro compromete predominantemente el sistema musculoesquelético. A nivel de estructuras: compromiso probable del complejo patelofemoral derecho, sustentado por dolor localizado en cara anterior de rodilla que aumenta con actividades de carga en flexión. A nivel de funciones: dolor moderado (6/10) en actividades provocadoras, disminución moderada de rango de movimiento de flexión (90° vs 135° contralateral), déficit leve de fuerza de cuádriceps, disminución moderada de tolerancia a carga en miembro inferior derecho.</p>
                </div>
              </div>

              <div className="border-t border-indigo-100 pt-4">
                <p className="font-bold text-indigo-700 text-sm">4. Factores contextuales</p>
                <p className="text-slate-600 italic mt-2 leading-relaxed">Factores personales: [facilitadores] y [barreras]. Factores ambientales: [facilitadores] y [barreras].</p>
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <p className="text-green-800 text-[11px]"><strong>Ejemplo:</strong> Factores personales: como facilitador, la persona presenta alta motivación por mejorar y buena comprensión del problema; como barrera, es sedentaria y presenta sobrepeso. Factores ambientales: como facilitador, tiene horario estable que permite asistir a sesiones; como barrera, su trabajo exige subir y bajar escaleras frecuentemente y no puede modificar esa exigencia.</p>
                </div>
              </div>
            </div>
          </div>

          <FieldTA
            label="Diagnóstico kinesiológico incipiente redactado por la dupla"
            value={caso.enunciadoDiagnostico}
            onChange={(v) => setCaso({ ...caso, enunciadoDiagnostico: v })}
            required
            rows={18}
            placeholder="Escriban su diagnóstico kinesiológico siguiendo la plantilla de arriba. Incluyan los 4 puntos: (1) Identificación y contexto, (2) Problemas desde la persona, (3) Problemas desde el tratante (estructuras y funciones con severidad), y (4) Factores contextuales (facilitadores y barreras)."
          />
        </SectionCard>

        {/* 7. Objetivos de Intervención (Dimensiones CIF) */}
        <SectionCard title="7. Objetivos de intervención (Dimensiones CIF)">
          <GuideBox title="Guía para la formulación de objetivos">
            <p>Los objetivos deben guardar coherencia directa con el diagnóstico kinesiológico planteado, ser alcanzables y medibles (formato SMART). Se debe definir un <strong>Objetivo General</strong> y <strong>Objetivos Específicos</strong> por cada dimensión CIF.</p>
          </GuideBox>

          <div className="border border-indigo-200 rounded-xl overflow-hidden mb-4">
            <button
              type="button"
              onClick={() => setShowObjExample(!showObjExample)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition text-sm font-semibold text-indigo-700"
            >
              <span>{showObjExample ? "Ocultar" : "Ver"} ejemplos de objetivos SMART por dimensión CIF</span>
              <span>{showObjExample ? "▲" : "▼"}</span>
            </button>
            {showObjExample && (
              <div className="px-4 py-4 bg-white text-xs text-slate-700 space-y-2.5 leading-relaxed border-t border-indigo-200">
                <p><strong>Objetivo General:</strong> &quot;Mejorar la capacidad funcional del miembro inferior derecho para permitir subir y bajar escaleras sin dolor en un plazo de 4 semanas.&quot;</p>
                <p><strong>Específico Estructuras y Funciones:</strong> &quot;Aumentar el rango de flexión activa de rodilla de 90° a 120° y disminuir la intensidad del dolor a ≤ 2/10 EVA en actividades de carga durante 3 semanas.&quot;</p>
                <p><strong>Específico Actividades:</strong> &quot;Reeducar la transferencia de sedente a bípedo y la técnica de marcha en escaleras sin compensación antálgica en 2 semanas.&quot;</p>
                <p><strong>Específico Participación:</strong> &quot;Favorecer la reintegración laboral completa con pautas de dosificación de carga articular en 4 semanas.&quot;</p>
              </div>
            )}
          </div>

          <FieldTA
            label="Objetivo General de intervención"
            required
            rows={3}
            value={caso.objetivos.objetivoGeneral}
            onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, objetivoGeneral: v } })}
            placeholder="Formula el objetivo general de la intervención..."
          />

          <div className="border-t border-slate-200 pt-4 space-y-4">
            <FieldTA
              label="Objetivo Específico: Estructuras y Funciones Corporales"
              required
              rows={2}
              value={caso.objetivos.estructurasFunciones}
              onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, estructurasFunciones: v } })}
              placeholder="Ej: Aumentar rango articular, modular dolor, mejorar fuerza..."
            />

            <FieldTA
              label="Objetivo Específico: Actividades"
              required
              rows={2}
              value={caso.objetivos.actividades}
              onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, actividades: v } })}
              placeholder="Ej: Mejorar marcha en escaleras, agacharse, transferencias..."
            />

            <FieldTA
              label="Objetivo Específico: Participación"
              required
              rows={2}
              value={caso.objetivos.participacion}
              onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, participacion: v } })}
              placeholder="Ej: Desempeño laboral, actividades recreativas o comunitarias..."
            />
          </div>
        </SectionCard>

        {/* 8. Plan de Intervención */}
        <SectionCard title="8. Plan de intervención propuesto (Estrategias CIF)">
          <GuideBox title="Guía para el plan de intervención">
            <p>El plan debe ser <strong>coherente con los objetivos formulados</strong> y considerar al menos <strong>una estrategia de intervención para cada dimensión CIF</strong> (Estructuras/Funciones, Actividades y Participación).</p>
          </GuideBox>

          <div className="border border-indigo-200 rounded-xl overflow-hidden mb-4">
            <button
              type="button"
              onClick={() => setShowPlanExample(!showPlanExample)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition text-sm font-semibold text-indigo-700"
            >
              <span>{showPlanExample ? "Ocultar" : "Ver"} ejemplos de estrategias de intervención</span>
              <span>{showPlanExample ? "▲" : "▼"}</span>
            </button>
            {showPlanExample && (
              <div className="px-4 py-4 bg-white text-xs text-slate-700 space-y-2.5 leading-relaxed border-t border-indigo-200">
                <p><strong>Estrategia Estructuras/Funciones:</strong> Terapia manual de deslizamiento patelar, ejercicio terapéutico de fortalecimiento isométrico y concéntrico de cuádriceps y glúteo medio (3 series de 10 repeticiones, 3 veces por semana) y estiramiento de cadena posterior.</p>
                <p><strong>Estrategia Actividades:</strong> Entrenamiento específico de la tarea de subir y bajar escaleras con peldaño regulable y reeducación de transferencias de carga en sedente a bípedo.</p>
                <p><strong>Estrategia Participación:</strong> Educación ergonómica en el puesto de trabajo, diseño de un programa de pausas activas cada 2 horas y entrega de pauta de ejercicios domiciliarios.</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <FieldTA
              label="Estrategia(s) para Estructuras y Funciones Corporales"
              required
              rows={3}
              value={caso.planIntervencion.estructurasFunciones}
              onChange={(v) =>
                setCaso({ ...caso, planIntervencion: { ...caso.planIntervencion, estructurasFunciones: v } })
              }
              placeholder="Detallen técnicas, ejercicios, dosificación (series, reps, frecuencia) y progresión..."
            />

            <FieldTA
              label="Estrategia(s) para Actividades"
              required
              rows={3}
              value={caso.planIntervencion.actividades}
              onChange={(v) =>
                setCaso({ ...caso, planIntervencion: { ...caso.planIntervencion, actividades: v } })
              }
              placeholder="Detallen entrenamiento funcional de tareas específicas (marcha, escaleras, transferencias)..."
            />

            <FieldTA
              label="Estrategia(s) para Participación"
              required
              rows={3}
              value={caso.planIntervencion.participacion}
              onChange={(v) =>
                setCaso({ ...caso, planIntervencion: { ...caso.planIntervencion, participacion: v } })
              }
              placeholder="Detallen adaptaciones contextuales, educación laboral/familiar y pautas domiciliarias..."
            />
          </div>
        </SectionCard>

        {/* 9. Pronóstico Incipiente */}
        <SectionCard title="9. Pronóstico (incipiente) final y factores pronósticos">
          <GuideBox title="Guía para el pronóstico incipiente">
            <p>El pronóstico debe estar <strong>fundamentado en la respuesta biológica y funcional esperada</strong>, relacionarse con el diagnóstico y el plan, e identificar <strong>al menos 3 factores pronósticos</strong>.</p>
          </GuideBox>

          <div className="border border-indigo-200 rounded-xl overflow-hidden mb-4">
            <button
              type="button"
              onClick={() => setShowPronosticoExample(!showPronosticoExample)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition text-sm font-semibold text-indigo-700"
            >
              <span>{showPronosticoExample ? "Ocultar" : "Ver"} ejemplo de pronóstico fundamentado</span>
              <span>{showPronosticoExample ? "▲" : "▼"}</span>
            </button>
            {showPronosticoExample && (
              <div className="px-4 py-4 bg-white text-xs text-slate-700 space-y-2.5 leading-relaxed border-t border-indigo-200">
                <p><strong>Fundamentación:</strong> &quot;Pronóstico favorable a mediano plazo (4 a 6 semanas) para la recuperación de la funcionalidad en marcha y escaleras, sustentado en la ausencia de daño estructural agudo y la respuesta positiva inicial a la descarga mecánica.&quot;</p>
                <p><strong>Relación Diagnóstico / Plan:</strong> &quot;El plan propuesto fortalece la musculatura estabilizadora de cadera y rodilla, corrigiendo la sobrecarga en el complejo patelofemoral identificado en el diagnóstico.&quot;</p>
              </div>
            )}
          </div>

          <FieldTA
            label="Fundamentación del pronóstico incipiente"
            required
            rows={4}
            value={caso.pronostico.fundamentacion}
            onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, fundamentacion: v } })}
            placeholder="Fundamenten la expectativa de evolución funcional de la persona..."
          />

          <FieldTA
            label="Relación con el diagnóstico e intervención propuesta"
            required
            rows={3}
            value={caso.pronostico.relacionDiagnosticoEIntervencion}
            onChange={(v) =>
              setCaso({ ...caso, pronostico: { ...caso.pronostico, relacionDiagnosticoEIntervencion: v } })
            }
            placeholder="Expliquen cómo el plan y el diagnóstico sustentan este pronóstico..."
          />

          <div className="pt-2">
            <Label required>Factores pronósticos (Mínimo 3 requeridos):</Label>
            <div className="space-y-3 mt-2">
              <FieldInput
                label="Factor Pronóstico 1"
                required
                value={caso.pronostico.factorPronostico1}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico1: v } })}
                placeholder="Ej: (+) Alta motivación y buena adherencia al tratamiento kinésico"
              />
              <FieldInput
                label="Factor Pronóstico 2"
                required
                value={caso.pronostico.factorPronostico2}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico2: v } })}
                placeholder="Ej: (-) Alta exigencia de carga laboral no modificable en el corto plazo"
              />
              <FieldInput
                label="Factor Pronóstico 3"
                required
                value={caso.pronostico.factorPronostico3}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico3: v } })}
                placeholder="Ej: (+) Red de apoyo familiar activa y ausencia de comorbilidades descompensadas"
              />
            </div>
          </div>
        </SectionCard>

        {/* 10. Autoevaluación */}
        <SectionCard title="10. Autoevaluación de la práctica">
          <FieldTA
            label="¿Cuál fue la mayor dificultad experimentada en el diseño de esta intervención?"
            rows={3}
            value={caso.autoevaluacion.mayorDificultad}
            onChange={(v) => setCaso({ ...caso, autoevaluacion: { ...caso.autoevaluacion, mayorDificultad: v } })}
          />
          <FieldTA
            label="¿Qué información o datos consideras que hicieron falta durante la evaluación?"
            rows={3}
            value={caso.autoevaluacion.informacionFaltante}
            onChange={(v) => setCaso({ ...caso, autoevaluacion: { ...caso.autoevaluacion, informacionFaltante: v } })}
          />
          <FieldTA
            label="¿Qué mejoras aplicarías para futuras intervenciones kinesiológicas similares?"
            rows={3}
            value={caso.autoevaluacion.mejoras}
            onChange={(v) => setCaso({ ...caso, autoevaluacion: { ...caso.autoevaluacion, mejoras: v } })}
          />
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
