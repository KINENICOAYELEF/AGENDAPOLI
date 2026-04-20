"use client";

import { useState, useEffect, useCallback } from "react";
import { enviarEntrega } from "@/services/pasantia";
import { casoClincoVacio } from "@/types/pasantia";
import type { CasoClinco, DatosDupla, EvaluacionSimple } from "@/types/pasantia";

// ─── Util ────────────────────────────────────────────────────────────────────
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
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1.5 leading-relaxed">
      <p className="font-bold text-sm text-blue-800 mb-2">{title}</p>
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

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <span className="text-2xl">{icon}</span>
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

// ─── CIF Item con severidad ──────────────────────────────────────────────────
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
  } catch { /* not JSON – legacy plain text */ }
  if (!raw.trim()) return [{ id: guid(), texto: "", severidad: "" }];
  // Fallback: treat as single item
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
          <button type="button" onClick={onRemove} className="px-2 text-red-400 hover:text-red-600 text-lg transition" title="Eliminar">✕</button>
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
                item.severidad === s.val ? s.color : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300"
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
  icon,
  title,
  subtitle,
  helpContent,
  items,
  onChange,
  placeholder,
  showSeveridad,
  maxItems,
}: {
  icon: string;
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
        {icon} {title} <span className="text-red-500">*</span>
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
        <button type="button" onClick={add} className="mt-2 w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 text-xs font-semibold rounded-lg hover:bg-white hover:border-teal-300 hover:text-teal-600 transition">
          + Agregar otro ({items.length}/{max})
        </button>
      )}
    </div>
  );
}

// ─── Sección 1: Datos generales ──────────────────────────────────────────────
function SeccionDatosGenerales({
  data,
  onChange,
}: {
  data: CasoClinco["datosUsuaria"];
  onChange: (d: CasoClinco["datosUsuaria"]) => void;
}) {
  const set = (key: keyof typeof data, val: string) => onChange({ ...data, [key]: val });
  return (
    <SectionCard title="1. Datos generales de la persona atendida" icon="🧑‍⚕️">
      <HelpText>
        Registren datos básicos que permitan entender quién es la persona y por qué fue atendida. No escriban información innecesaria ni datos sensibles que no aporten al caso.
      </HelpText>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldInput label="Nombre o iniciales" value={data.nombre} onChange={(v) => set("nombre", v)} required placeholder="Ej: M.G. o María G." />
        <FieldInput label="Edad" value={data.edad} onChange={(v) => set("edad", v)} required placeholder="Ej: 42 años" />
        <FieldInput label="Ocupación o actividad principal" value={data.ocupacion} onChange={(v) => set("ocupacion", v)} required placeholder="Ej: Auxiliar de aseo, estudiante, deportista recreativa..." />
        <FieldInput label="Contexto de atención" value={data.contextoAtencion} onChange={(v) => set("contextoAtencion", v)} required placeholder="Ej: CESFAM, centro comunitario, hospital..." />
      </div>
      <FieldTA
        label="Motivo principal de consulta o atención"
        value={data.motivoConsulta}
        onChange={(v) => set("motivoConsulta", v)}
        required
        rows={4}
        placeholder="Describe el motivo según lo que la persona refiere. Ej: Consulta por dolor en rodilla derecha que le dificulta caminar y subir escaleras desde hace 3 semanas..."
      />
    </SectionCard>
  );
}

// ─── Sección 2: Anamnesis ────────────────────────────────────────────────────
function SeccionAnamnesis({
  data,
  onChange,
}: {
  data: { anamnesis: string; interpretacionAnamnesis: string };
  onChange: (k: "anamnesis" | "interpretacionAnamnesis", v: string) => void;
}) {
  const [showExample, setShowExample] = useState(false);

  return (
    <SectionCard title="2. Anamnesis / Entrevista clínica" icon="🗣️">
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
      <div className="border border-indigo-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowExample(!showExample)}
          className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition text-sm font-semibold text-indigo-700"
        >
          <span>📄 {showExample ? "Ocultar" : "Ver"} ejemplo de anamnesis bien registrada</span>
          <span>{showExample ? "▲" : "▼"}</span>
        </button>
        {showExample && (
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
        value={data.anamnesis}
        onChange={(v) => onChange("anamnesis", v)}
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
            value={data.interpretacionAnamnesis}
            onChange={(v) => onChange("interpretacionAnamnesis", v)}
            required
            rows={10}
            placeholder="Expliquen como tratantes: ¿Qué datos de la entrevista son los más relevantes clínicamente? ¿Por qué? ¿Qué hipótesis empiezan a formarse sobre el problema? ¿Qué prioridades clínicas identifican?..."
          />
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Sección 3: Evaluaciones ─────────────────────────────────────────────────
function SeccionEvaluaciones({
  evaluaciones,
  onChange,
}: {
  evaluaciones: EvaluacionSimple[];
  onChange: (evals: EvaluacionSimple[]) => void;
}) {
  const update = (id: string, key: keyof EvaluacionSimple, val: string) =>
    onChange(evaluaciones.map((e) => (e.id === id ? { ...e, [key]: val } : e)));
  const add = () => {
    if (evaluaciones.length >= 4) return;
    onChange([...evaluaciones, { id: guid(), nombre: "", razon: "", resultado: "", interpretacion: "" }]);
  };
  const remove = (id: string) => {
    if (evaluaciones.length <= 2) return;
    onChange(evaluaciones.filter((e) => e.id !== id));
  };

  return (
    <SectionCard title="3. Evaluaciones simples realizadas por el tratante" icon="📋">
      <GuideBox title="¿Qué tipo de evaluaciones se esperan?">
        <p>Registren entre <strong>2 y 4 evaluaciones simples y seguras</strong> que realizaron como tratantes. Cada una debe tener: nombre, razón clínica de elección, resultado obtenido e interpretación inmediata.</p>
        <p className="mt-1.5">Pueden ser: observación del movimiento o postura · ROM activo · evaluación del dolor (EVA) · fuerza manual básica · equilibrio (Romberg, apoyo unipodal) · evaluación de marcha · transferencias · tarea funcional relevante · otra pertinente al caso.</p>
      </GuideBox>

      <div className="space-y-5">
        {evaluaciones.map((ev, idx) => (
          <div key={ev.id} className="border border-slate-200 rounded-xl p-5 bg-slate-50 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Evaluación {idx + 1}</span>
              {evaluaciones.length > 2 && (
                <button type="button" onClick={() => remove(ev.id)} className="text-xs text-red-400 hover:text-red-600 transition font-medium">✕ Eliminar</button>
              )}
            </div>
            <div className="space-y-3">
              <FieldInput label="Nombre de la evaluación" value={ev.nombre} onChange={(v) => update(ev.id, "nombre", v)} required placeholder="Ej: Rango de movimiento activo de flexión de rodilla derecha" />
              <FieldTA label="¿Por qué eligieron esta evaluación?" value={ev.razon} onChange={(v) => update(ev.id, "razon", v)} required rows={3} placeholder="Ej: Porque la persona refiere dolor al flectar la rodilla y necesitamos cuantificar la limitación antes de intervenir..." />
              <FieldInput label="Resultado obtenido" value={ev.resultado} onChange={(v) => update(ev.id, "resultado", v)} required placeholder="Ej: 90° de flexión activa (contralateral 135°), dolor 6/10 al final del rango" />
              <FieldTA label="Interpretación inmediata del resultado" value={ev.interpretacion} onChange={(v) => update(ev.id, "interpretacion", v)} required rows={4} placeholder="¿Qué significa este resultado para el caso? Ej: La limitación de 90° con dolor al final del rango indica restricción significativa. Se requieren al menos 110° para subir escaleras normalmente, que es su actividad más limitada..." />
            </div>
          </div>
        ))}
      </div>
      {evaluaciones.length < 4 && (
        <button type="button" onClick={add} className="mt-3 w-full py-3 border-2 border-dashed border-teal-300 text-teal-600 font-semibold text-sm rounded-xl hover:bg-teal-50 transition">
          + Agregar evaluación ({evaluaciones.length}/4)
        </button>
      )}
    </SectionCard>
  );
}

// ─── Sección 4: Hallazgos ────────────────────────────────────────────────────
function SeccionHallazgos({
  data,
  onChange,
}: {
  data: { hallazgo1: string; hallazgo2: string; hallazgo3: string };
  onChange: (k: keyof typeof data, v: string) => void;
}) {
  return (
    <SectionCard title="4. Hallazgos principales del tratante" icon="🔍">
      <GuideBox title="¿Qué poner aquí?">
        <p>Seleccionen <strong>solo los 3 datos más importantes</strong> que obtuvieron de la entrevista y la evaluación. No escriban todo. Elijan lo que realmente ayuda a entender el caso.</p>
        <p className="mt-1 italic text-blue-700">Ejemplo: &quot;Limitación significativa de flexión activa de rodilla (90° vs 135° contralateral) con dolor 6/10 al final del rango, compatible con compromiso del complejo patelofemoral por sobreuso.&quot;</p>
      </GuideBox>
      <FieldTA label="Hallazgo 1 (el más relevante)" value={data.hallazgo1} onChange={(v) => onChange("hallazgo1", v)} required rows={3} placeholder="El hallazgo más importante..." />
      <FieldTA label="Hallazgo 2" value={data.hallazgo2} onChange={(v) => onChange("hallazgo2", v)} required rows={3} placeholder="Segundo hallazgo relevante..." />
      <FieldTA label="Hallazgo 3" value={data.hallazgo3} onChange={(v) => onChange("hallazgo3", v)} required rows={3} placeholder="Tercer hallazgo relevante..." />
    </SectionCard>
  );
}

// ─── Sección 5: CIF con ítems dinámicos + severidad ──────────────────────────
function SeccionCIF({
  data,
  onChange,
}: {
  data: CasoClinco["cif"];
  onChange: (k: keyof CasoClinco["cif"], v: string) => void;
}) {
  // Parse/serialize each CIF field as a list of items
  const getItems = (key: keyof CasoClinco["cif"]) => parseCifItems(data[key]);
  const setItems = (key: keyof CasoClinco["cif"], items: CifItem[]) => onChange(key, serializeCifItems(items));

  return (
    <SectionCard title="5. Tabla CIF – Clasificación del caso" icon="📊">
      <GuideBox title="Guía para completar la CIF">
        <p>La CIF (Clasificación Internacional del Funcionamiento) sirve para <strong>ordenar y clasificar profesionalmente el caso</strong>. Cada componente responde a una pregunta diferente.</p>
        <div className="mt-2 bg-white border border-blue-200 rounded-lg p-3 space-y-1">
          <p>🦴 <strong>Estructuras</strong> = ¿Qué parte del cuerpo está comprometida? (tejidos físicos)</p>
          <p>⚡ <strong>Funciones</strong> = ¿Qué capacidad está alterada? (dolor, fuerza, movilidad...)</p>
          <p>🚶 <strong>Actividades</strong> = ¿Qué tareas concretas no puede hacer bien?</p>
          <p>👥 <strong>Participación</strong> = ¿Cómo afecta su vida real, roles, rutina?</p>
          <p>🧠 <strong>F. Personales</strong> = ¿Qué de la persona facilita o dificulta?</p>
          <p>🏠 <strong>F. Ambientales</strong> = ¿Qué del entorno ayuda o dificulta?</p>
        </div>
      </GuideBox>

      {/* Guía de severidad */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-xs text-purple-900 space-y-2">
        <p className="font-bold text-sm text-purple-800">📏 ¿Cómo clasificar la severidad?</p>
        <p>Cuando agreguen funciones alteradas, actividades limitadas o restricciones de participación, deben indicar <strong>qué tan afectado</strong> está cada ítem. Usen esta escala:</p>
        <div className="mt-2 space-y-2">
          <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold shrink-0 mt-0.5">Leve</span>
            <div>
              <p className="font-semibold text-purple-800">La persona puede hacerlo, pero con algo de dificultad o molestia menor.</p>
              <p className="text-purple-600 italic mt-0.5">Ej: &quot;Caminar — leve: puede caminar normalmente pero siente molestia leve después de 1 km&quot;</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold shrink-0 mt-0.5">Moderado</span>
            <div>
              <p className="font-semibold text-purple-800">La persona puede hacerlo, pero con dificultad importante. Necesita adaptarse, ir más lento o modificar la tarea.</p>
              <p className="text-purple-600 italic mt-0.5">Ej: &quot;Subir escaleras — moderado: puede subir pero debe ir lento, agarrarse del pasamanos y parar a descansar cada piso&quot;</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-bold shrink-0 mt-0.5">Severo</span>
            <div>
              <p className="font-semibold text-purple-800">La persona tiene mucha dificultad. Casi no puede hacerlo o necesita ayuda de otra persona.</p>
              <p className="text-purple-600 italic mt-0.5">Ej: &quot;Agacharse — severo: prácticamente no puede agacharse, necesita que otra persona le recoja los objetos del suelo&quot;</p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-purple-100">
            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold shrink-0 mt-0.5">Completo</span>
            <div>
              <p className="font-semibold text-purple-800">La persona no puede hacerlo en absoluto. La limitación es total.</p>
              <p className="text-purple-600 italic mt-0.5">Ej: &quot;Correr — completo: no puede correr ni trotar, genera dolor intenso e inmediato&quot;</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-900">
        <p className="font-bold">⚠️ Importante:</p>
        <p className="mt-1">Cada ítem que agreguen <strong>debe haber sido encontrado en la entrevista o la evaluación</strong>. No inventen ni supongan cosas que no observaron. Los ejemplos son solo orientativos — los ítems reales dependen de cada caso. Pueden agregar tantos ítems como sean necesarios usando el botón &quot;+ Agregar otro&quot;.</p>
      </div>

      <CifSection
        icon="🦴"
        title="A. Estructuras corporales"
        subtitle="¿Qué estructuras del cuerpo podrían estar relacionadas con el problema?"
        helpContent={
          <HelpText>
            Registren los <strong>tejidos, articulaciones, músculos, tendones, ligamentos, nervios o huesos</strong> que podrían estar involucrados según lo que encontraron en la entrevista y evaluación. No necesitan estar 100% seguros — pueden indicar estructuras &quot;sospechadas&quot;. No se usa severidad aquí.
            <br/><br/>
            <strong>Algunos ejemplos (dependen del caso):</strong> Complejo patelofemoral derecho · Tendón rotuliano · Musculatura cuadricipital · Columna lumbar (segmentos L4-L5) · Manguito rotador · Nervio mediano · Fascia plantar · Ligamento colateral medial · Cápsula glenohumeral.
          </HelpText>
        }
        items={getItems("estructurasCorporales")}
        onChange={(items) => setItems("estructurasCorporales", items)}
        placeholder="Ej: Complejo patelofemoral derecho"
        showSeveridad={false}
      />

      <CifSection
        icon="⚡"
        title="B. Funciones corporales alteradas"
        subtitle="¿Qué funciones corporales encontraron alteradas en la evaluación?"
        helpContent={
          <HelpText>
            Las funciones son <strong>capacidades del cuerpo</strong> que están disminuidas o alteradas. No son las estructuras (esas van arriba) ni las actividades (esas van abajo). <strong>Seleccionen la severidad</strong> según la guía de arriba.
            <br/><br/>
            <strong>Algunos ejemplos (incluyan solo las que encontraron alteradas):</strong> Dolor en región anterior de rodilla · Movilidad articular de flexión de rodilla · Fuerza muscular de cuádriceps · Control motor dinámico de rodilla · Equilibrio en apoyo unipodal · Tolerancia a carga en miembro inferior · Propiocepción · Edema periarticular.
          </HelpText>
        }
        items={getItems("funcionesCorporales")}
        onChange={(items) => setItems("funcionesCorporales", items)}
        placeholder="Ej: Dolor en región anterior de rodilla"
        showSeveridad={true}
      />

      <CifSection
        icon="🚶"
        title="C. Actividades limitadas"
        subtitle="¿Qué actividades concretas están limitadas?"
        helpContent={
          <HelpText>
            Las actividades son <strong>tareas y acciones concretas</strong> que la persona tiene dificultad o no puede hacer. Son verbos o acciones, no diagnósticos ni funciones. <strong>Seleccionen la severidad</strong> según la guía.
            <br/><br/>
            <strong>Algunos ejemplos (incluyan las que la persona reportó o que ustedes observaron):</strong> Subir escaleras · Caminar distancias largas (&gt;500m) · Agacharse a recoger objetos · Sentarse y levantarse de silla baja · Correr · Levantar objetos del suelo · Vestirse la parte inferior · Permanecer de pie más de 30 minutos.
          </HelpText>
        }
        items={getItems("actividades")}
        onChange={(items) => setItems("actividades", items)}
        placeholder="Ej: Subir escaleras"
        showSeveridad={true}
      />

      <CifSection
        icon="👥"
        title="D. Restricción de participación"
        subtitle="¿En qué roles o situaciones de la vida real participa menos o con dificultad?"
        helpContent={
          <HelpText>
            La participación es el <strong>impacto en la vida real</strong>: sus roles, rutina y cosas que le importan. No es lo mismo que actividades: subir escaleras es actividad; no poder ir al trabajo porque hay escaleras es <strong>participación</strong>. <strong>Seleccionen la severidad</strong>.
            <br/><br/>
            <strong>Algunos ejemplos (según lo que la persona contó):</strong> Cumplir jornada laboral completa · Participar en actividades deportivas recreativas · Cumplir rol de cuidador/a de hijos · Actividades sociales con amigos · Independencia en tareas del hogar · Actividades de ocio · Vida académica o de estudios.
          </HelpText>
        }
        items={getItems("participacion")}
        onChange={(items) => setItems("participacion", items)}
        placeholder="Ej: Cumplir jornada laboral completa"
        showSeveridad={true}
      />

      <CifSection
        icon="🧠"
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
        items={getItems("factoresPersonales")}
        onChange={(items) => setItems("factoresPersonales", items)}
        placeholder="Ej: (+) Alta motivación por mejorar"
        showSeveridad={false}
      />

      <CifSection
        icon="🏠"
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
        items={getItems("factoresAmbientales")}
        onChange={(items) => setItems("factoresAmbientales", items)}
        placeholder="Ej: (-) Vive en tercer piso sin ascensor"
        showSeveridad={false}
      />
    </SectionCard>
  );
}

// ─── Sección 6: Diagnóstico kinesiológico ────────────────────────────────────
function SeccionDiagnostico({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <SectionCard title="6. Diagnóstico kinesiológico incipiente" icon="🎯">
      <GuideBox title="¿Qué es un diagnóstico kinesiológico?">
        <p>Un diagnóstico kinesiológico <strong>NO es decir &quot;tiene tendinitis&quot; o &quot;tiene dolor lumbar&quot;</strong>. Eso es un diagnóstico médico.</p>
        <p className="mt-1.5">Un diagnóstico kinesiológico es un <strong>texto integrador</strong> donde ustedes como tratantes resumen y conectan toda la información que obtuvieron: quién es la persona, qué problema tiene, qué encontraron en la evaluación, y qué factores influyen.</p>
        <p className="mt-1.5">A continuación tienen una <strong>plantilla que deben seguir</strong>. Reemplacen los textos en [corchetes] con la información real de su caso. No copien los corchetes — escriban directamente lo que corresponda.</p>
      </GuideBox>

      {/* Plantilla simplificada a 4 puntos */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-xs text-indigo-900 space-y-4">
        <p className="font-bold text-sm text-indigo-800">📝 Plantilla a seguir — reemplacen los [corchetes] con su información</p>

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

      <div className="mt-5">
        <FieldTA
          label="Diagnóstico kinesiológico incipiente redactado por la dupla"
          value={value}
          onChange={onChange}
          required
          rows={18}
          placeholder="Escriban su diagnóstico kinesiológico siguiendo la plantilla de arriba. Incluyan los 4 puntos: (1) Identificación y contexto, (2) Problemas desde la persona, (3) Problemas desde el tratante (estructuras y funciones con severidad), y (4) Factores contextuales (facilitadores y barreras)."
        />
      </div>
    </SectionCard>
  );
}

// ─── Bloque Caso ─────────────────────────────────────────────────────────────
function BloqueCaso({ numero, caso, onChange }: { numero: number; caso: CasoClinco; onChange: (c: CasoClinco) => void }) {
  const set = <K extends keyof CasoClinco>(key: K, val: CasoClinco[K]) => onChange({ ...caso, [key]: val });

  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-6 sticky top-0 bg-gradient-to-r from-slate-50 via-teal-50/30 to-cyan-50/20 py-3 z-10">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-black text-lg shadow-md ring-4 ring-white">
          {numero}
        </div>
        <h2 className="text-xl font-black text-slate-800">Caso Clínico {numero}</h2>
      </div>

      <SeccionDatosGenerales data={caso.datosUsuaria} onChange={(d) => set("datosUsuaria", d)} />
      <SeccionAnamnesis
        data={{ anamnesis: caso.anamnesis, interpretacionAnamnesis: caso.interpretacionAnamnesis }}
        onChange={(k, v) => set(k, v)}
      />
      <SeccionEvaluaciones evaluaciones={caso.evaluaciones} onChange={(evals) => set("evaluaciones", evals)} />
      <SeccionHallazgos
        data={{ hallazgo1: caso.hallazgo1, hallazgo2: caso.hallazgo2, hallazgo3: caso.hallazgo3 }}
        onChange={(k, v) => set(k, v)}
      />
      <SeccionCIF data={caso.cif} onChange={(k, v) => set("cif", { ...caso.cif, [k]: v })} />
      <SeccionDiagnostico value={caso.diagnosticoKinesiologico} onChange={(v) => set("diagnosticoKinesiologico", v)} />
    </div>
  );
}

// ─── Validación ──────────────────────────────────────────────────────────────
function validateCifField(raw: string, label: string, prefix: string): string[] {
  const items = parseCifItems(raw);
  const filledItems = items.filter((i) => i.texto.trim());
  if (filledItems.length === 0) return [`${prefix}: ${label} — agrega al menos un ítem`];
  return [];
}

function validateCaso(caso: CasoClinco, num: number): string[] {
  const errors: string[] = [];
  const p = `Caso ${num}`;
  if (!caso.datosUsuaria.nombre.trim()) errors.push(`${p}: Nombre de la persona`);
  if (!caso.datosUsuaria.edad.trim()) errors.push(`${p}: Edad`);
  if (!caso.datosUsuaria.ocupacion.trim()) errors.push(`${p}: Ocupación`);
  if (!caso.datosUsuaria.contextoAtencion.trim()) errors.push(`${p}: Contexto de atención`);
  if (!caso.datosUsuaria.motivoConsulta.trim()) errors.push(`${p}: Motivo de consulta`);
  if (!caso.anamnesis.trim()) errors.push(`${p}: Anamnesis`);
  if (!caso.interpretacionAnamnesis.trim()) errors.push(`${p}: Interpretación de la anamnesis`);
  if (caso.evaluaciones.length < 2) errors.push(`${p}: Se requieren al menos 2 evaluaciones`);
  caso.evaluaciones.forEach((ev, i) => {
    if (!ev.nombre.trim()) errors.push(`${p} Eval. ${i + 1}: Nombre`);
    if (!ev.resultado.trim()) errors.push(`${p} Eval. ${i + 1}: Resultado`);
    if (!ev.interpretacion.trim()) errors.push(`${p} Eval. ${i + 1}: Interpretación`);
  });
  if (!caso.hallazgo1.trim() || !caso.hallazgo2.trim() || !caso.hallazgo3.trim())
    errors.push(`${p}: Los 3 hallazgos principales son obligatorios`);
  errors.push(...validateCifField(caso.cif.estructurasCorporales, "Estructuras corporales", p));
  errors.push(...validateCifField(caso.cif.funcionesCorporales, "Funciones corporales", p));
  errors.push(...validateCifField(caso.cif.actividades, "Actividades", p));
  errors.push(...validateCifField(caso.cif.participacion, "Participación", p));
  errors.push(...validateCifField(caso.cif.factoresPersonales, "Factores personales", p));
  errors.push(...validateCifField(caso.cif.factoresAmbientales, "Factores ambientales", p));
  if (!caso.diagnosticoKinesiologico.trim()) errors.push(`${p}: Diagnóstico kinesiológico`);
  return errors;
}

// ─── FORMULARIO PRINCIPAL ────────────────────────────────────────────────────
export default function FormularioPasantia() {
  const [dupla, setDupla] = useState<DatosDupla>({ estudiante1: "", estudiante2: "", fechaJornada: "", centroAtencion: "" });
  const [caso1, setCaso1] = useState<CasoClinco>(casoClincoVacio);
  const [caso2, setCaso2] = useState<CasoClinco>(casoClincoVacio);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [entregaId, setEntregaId] = useState<string>("");
  const [enviado, setEnviado] = useState(false);

  // AutoSave
  useEffect(() => {
    try { localStorage.setItem("pasantia_draft", JSON.stringify({ dupla, caso1, caso2 })); } catch {/* */}
  }, [dupla, caso1, caso2]);

  // Restore
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pasantia_draft");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.dupla) setDupla(saved.dupla);
        if (saved.caso1) setCaso1(saved.caso1);
        if (saved.caso2) setCaso2(saved.caso2);
      }
    } catch {/* */}
  }, []);

  const handleSubmit = useCallback(async () => {
    const allErrors = [
      ...(!dupla.estudiante1.trim() ? ["Nombre del Estudiante 1"] : []),
      ...(!dupla.estudiante2.trim() ? ["Nombre del Estudiante 2"] : []),
      ...(!dupla.fechaJornada ? ["Fecha de la jornada"] : []),
      ...validateCaso(caso1, 1),
      ...validateCaso(caso2, 2),
    ];
    if (allErrors.length > 0) {
      setErrors(allErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors([]);
    setSending(true);
    try {
      const id = await enviarEntrega({ dupla, caso1, caso2 });
      setEntregaId(id);
      localStorage.removeItem("pasantia_draft");
      setEnviado(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setErrors(["Error al enviar: " + (err instanceof Error ? err.message : "Error desconocido")]);
    } finally {
      setSending(false);
    }
  }, [dupla, caso1, caso2]);

  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-lg w-full text-center space-y-5">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto"><span className="text-4xl">✅</span></div>
          <h1 className="text-2xl font-black text-slate-800">¡Entrega enviada con éxito!</h1>
          <p className="text-slate-600">Tu ficha fue registrada correctamente. El docente la revisará con rúbrica.</p>
          <div className="bg-slate-100 rounded-xl p-4 text-xs text-slate-500 font-mono break-all">ID: {entregaId}</div>
          <p className="text-xs text-slate-400">Guarda este ID como comprobante.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/20">
      <header className="bg-gradient-to-r from-teal-700 to-cyan-700 text-white py-6 px-4 shadow-lg">
        <div className="max-w-3xl mx-auto">
          <p className="text-teal-200 text-xs font-semibold uppercase tracking-wider mb-1">Pasantía 2º Año · Kinesiología</p>
          <h1 className="text-lg md:text-xl font-black leading-tight">Ficha de Observación, Entrevista, Evaluación Inicial y Razonamiento Kinésico Básico</h1>
          <p className="text-teal-100 text-sm mt-2 opacity-80">Entrega por dupla · 2 casos clínicos · Perspectiva del tratante</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-2xl p-5 mb-8">
            <p className="font-bold text-red-700 mb-2">⚠️ Completa los campos obligatorios:</p>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((e) => (<li key={e} className="text-sm text-red-600">{e}</li>))}
            </ul>
          </div>
        )}

        {/* Datos Dupla */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 mb-8">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">👫 Datos de la dupla</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput label="Nombre Estudiante 1" value={dupla.estudiante1} onChange={(v) => setDupla({ ...dupla, estudiante1: v })} required />
            <FieldInput label="Nombre Estudiante 2" value={dupla.estudiante2} onChange={(v) => setDupla({ ...dupla, estudiante2: v })} required />
            <FieldInput label="Fecha de la jornada" value={dupla.fechaJornada} onChange={(v) => setDupla({ ...dupla, fechaJornada: v })} required type="date" />
            <FieldInput label="Centro de atención (opcional)" value={dupla.centroAtencion || ""} onChange={(v) => setDupla({ ...dupla, centroAtencion: v })} placeholder="Nombre del centro..." />
          </div>
        </div>

        {/* Instrucciones */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-800 space-y-2 mb-8">
          <p className="font-bold">📋 Instrucciones generales</p>
          <p>Completen <strong>dos casos clínicos</strong> de personas atendidas durante la jornada. Todo debe registrarse <strong>desde su perspectiva como tratantes/kinesiólogos</strong>.</p>
          <p>Todos los campos marcados con <span className="text-red-500 font-bold">*</span> son obligatorios. El formulario guarda su progreso automáticamente en el navegador.</p>
          <p>Al terminar ambos casos, presionen <strong>&quot;Enviar definitivamente&quot;</strong> al final de la página.</p>
        </div>

        <BloqueCaso numero={1} caso={caso1} onChange={setCaso1} />

        <div className="flex items-center gap-4 my-12">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-teal-300 to-transparent" />
          <span className="text-teal-600 font-black text-sm uppercase tracking-widest">Fin Caso 1 · Inicio Caso 2</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-teal-300 to-transparent" />
        </div>

        <BloqueCaso numero={2} caso={caso2} onChange={setCaso2} />

        <div className="mt-10 mb-20">
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-full py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-lg rounded-2xl hover:from-emerald-700 hover:to-teal-700 shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Enviando..." : "✅ Enviar definitivamente"}
          </button>
          <p className="text-xs text-slate-400 text-center mt-3">Una vez enviado no podrás modificar tu entrega.</p>
        </div>
      </main>
    </div>
  );
}
